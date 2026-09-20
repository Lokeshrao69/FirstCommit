"""End-to-end API tests over the DEMO_MODE mock path.

Validates the service-template happy path described in the spec without any AWS
credentials: goal -> service template -> state-machine execution -> documents ->
deterministic validation -> human approval -> simulated submission -> audit trail.
Also covers the needs-review (acknowledge) fork and the blocked terminal.
"""

from __future__ import annotations

import os

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_services
from app.api.routes import router
from app.core.config import override_settings

DEMO_GOAL = "I want to apply for the post matric scholarship"
PENSION_GOAL = "I want to apply for the old age pension scheme"
INCOME_GOAL = "I need an income certificate"

SCHOLARSHIP_DOCS = [
    ("aadhaar.pdf", b"%PDF-1.4 fictional aadhaar", "application/pdf"),
    ("income_certificate_valid.pdf", b"%PDF-1.4 fictional income certificate", "application/pdf"),
    ("marks_memo.pdf", b"%PDF-1.4 fictional marks memo", "application/pdf"),
    ("bonafide_certificate.pdf", b"%PDF-1.4 fictional bonafide", "application/pdf"),
    ("bank_passbook_student.pdf", b"%PDF-1.4 fictional passbook", "application/pdf"),
]

SCHOLARSHIP_CLASSIFICATIONS = sorted(
    ["aadhaar", "bank_passbook", "bonafide_certificate", "income_certificate", "marks_memo"]
)


@pytest.fixture(scope="module")
def client() -> TestClient:
    override_settings({**os.environ, "DEMO_MODE": "true", "CORS_ORIGINS": "[\"http://localhost:5173\"]"})
    get_services.cache_clear()
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def create_workflow(client: TestClient, goal: str = DEMO_GOAL) -> str:
    r = client.post("/workflows", json={"goal": goal})
    assert r.status_code == 200
    return r.json()["workflow_id"]


def upload(client: TestClient, wid: str, name: str, content: bytes = b"%PDF-1.4 fictional") -> dict:
    r = client.post(
        f"/workflows/{wid}/documents",
        files={"file": (name, content, "application/pdf")},
    )
    assert r.status_code == 200, r.text
    assert r.json()["classification"] is not None
    return r.json()


def upload_all(client: TestClient, wid: str, docs=SCHOLARSHIP_DOCS) -> None:
    for name, content, mime in docs:
        r = client.post(
            f"/workflows/{wid}/documents",
            files={"file": (name, content, mime)},
        )
        assert r.status_code == 200, r.text
        assert r.json()["classification"] is not None


def advance(client: TestClient, wid: str, **payload) -> dict:
    r = client.post(f"/workflows/{wid}/advance", json=payload)
    assert r.status_code == 200, r.text
    return r.json()


def test_create_workflow_generates_valid_schema(client):
    r = client.post("/workflows", json={"goal": DEMO_GOAL})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "in_progress"
    wf = body["workflow"]
    assert wf["initial_state"] == "document_collection"
    assert set(wf["terminal_states"]) == {"completed", "cancelled", "blocked"}
    assert len(wf["states"]) == 8
    active_types = {s["type"] for s in wf["states"]}
    assert active_types == {"document_required", "validation", "human_approval", "execution", "terminal"}


def test_full_demo_path(client):
    wid = create_workflow(client)

    # first advance pauses at the document collection gate
    body = advance(client, wid)
    assert body["needs"] == "document_upload"
    assert body["progress"]["completed"] == 0

    # cannot skip to submission by approving early
    body = advance(client, wid, approval=True)
    assert body["needs"] == "document_upload"

    # upload the five required scholarship documents
    upload_all(client, wid)
    detail = client.get(f"/workflows/{wid}").json()
    assert detail["collected_documents"] == SCHOLARSHIP_CLASSIFICATIONS

    # advance -> documents gate auto-runs validation -> clean pass -> final approval
    body = advance(client, wid)
    assert body["needs"] == "approval"
    validation = body["validation"]
    assert validation is not None
    assert validation["status"] == "pass"
    assert validation["checked_documents"] == SCHOLARSHIP_CLASSIFICATIONS
    assert body["current_state"] == "final_approval"

    # approve -> submission auto-runs -> completed
    body = advance(client, wid, approval=True)
    assert body["completed"] is True
    assert body["status"] == "completed"
    assert body["submission"]["eligible"] is True
    assert body["submission"]["documents"] == SCHOLARSHIP_CLASSIFICATIONS

    audit = client.get(f"/workflows/{wid}/audit").json()["events"]
    types = {e["event_type"] for e in audit}
    assert "workflow_created" in types
    assert "workflow_generated" in types
    assert "document_uploaded" in types
    assert "field_extracted" in types
    assert "human_approval" in types
    assert "execution" in types
    assert "workflow_completed" in types


def test_needs_review_acknowledge_path(client):
    """A warn-only finding routes through `review_warnings` and can continue."""
    wid = create_workflow(client, goal=INCOME_GOAL)

    body = advance(client, wid)
    assert body["needs"] == "document_upload"

    upload(client, wid, "aadhaar.pdf")
    upload(client, wid, "income_self_declaration_stale.pdf")

    body = advance(client, wid)
    assert body["needs"] == "approval"
    assert body["current_state"] == "review_warnings"
    assert body["validation"]["status"] == "needs_review"
    fields = {i["field"] for i in body["validation"]["issues"]}
    assert "declaration_date" in fields

    # acknowledge the warning -> final human approval
    body = advance(client, wid, acknowledge=True)
    assert body["needs"] == "approval"
    assert body["current_state"] == "final_approval"

    # declining at final approval cancels instead of submitting
    body = advance(client, wid, approval=False)
    assert body["completed"] is True
    assert body["status"] == "cancelled"


def test_hard_rule_blocks_and_retains_documents(client):
    wid = create_workflow(client)

    advance(client, wid)
    upload(client, wid, "aadhaar.pdf")
    upload(client, wid, "income_certificate_over_limit.pdf")
    upload(client, wid, "marks_memo.pdf")
    upload(client, wid, "bonafide_certificate.pdf")
    upload(client, wid, "bank_passbook_student.pdf")

    body = advance(client, wid)
    assert body["status"] == "blocked"
    assert body["completed"] is True
    assert body["validation"]["status"] == "block"
    assert any(i["field"] == "annual_family_income" for i in body["validation"]["issues"])

    # blocked workflows are NOT purged: the applicant can still review what failed
    detail = client.get(f"/workflows/{wid}").json()
    assert detail["collected_documents"] == SCHOLARSHIP_CLASSIFICATIONS
    # a finished workflow no longer accepts documents or advances
    assert client.post(f"/workflows/{wid}/documents", files={"file": ("aadhaar.pdf", b"x", "application/pdf")}).status_code == 409
    assert client.post(f"/workflows/{wid}/advance", json={}).status_code == 409


def test_pension_goal_routes_to_pension_template(client):
    wid = create_workflow(client, goal=PENSION_GOAL)
    body = advance(client, wid)
    assert body["needs"] == "document_upload"

    upload(client, wid, "aadhaar_elderly.pdf")
    upload(client, wid, "ration_card.pdf")
    upload(client, wid, "bank_passbook.pdf")

    body = advance(client, wid)
    assert body["needs"] == "approval"
    assert body["validation"]["status"] == "pass"
    assert body["current_state"] == "final_approval"

    body = advance(client, wid, approval=True)
    assert body["status"] == "completed"


def test_pension_too_young_blocks(client):
    wid = create_workflow(client, goal=PENSION_GOAL)
    advance(client, wid)
    upload(client, wid, "aadhaar_too_young.pdf")
    upload(client, wid, "ration_card.pdf")
    upload(client, wid, "bank_passbook.pdf")

    body = advance(client, wid)
    assert body["status"] == "blocked"
    assert any(i["field"] == "date_of_birth" for i in body["validation"]["issues"])


def test_missing_field_blocks_fast(client):
    wid = create_workflow(client)
    advance(client, wid)
    upload(client, wid, "aadhaar.pdf")
    upload(client, wid, "income_certificate_valid.pdf")
    upload(client, wid, "marks_memo_no_percentage.pdf")
    upload(client, wid, "bonafide_certificate.pdf")
    upload(client, wid, "bank_passbook_student.pdf")

    body = advance(client, wid)
    assert body["status"] == "blocked"
    assert any(i["field"] == "percentage" for i in body["validation"]["issues"])


def test_create_workflow_never_consults_the_llm(client):
    """Workflow creation is template-driven; a broken LLM cannot stop it."""
    services = get_services()

    class BrokenProvider:
        def name(self) -> str:
            return "broken"

    original = services.workflow_service._llm
    services.workflow_service._llm = BrokenProvider()
    try:
        r = client.post("/workflows", json={"goal": DEMO_GOAL})
        assert r.status_code == 200
    finally:
        services.workflow_service._llm = original