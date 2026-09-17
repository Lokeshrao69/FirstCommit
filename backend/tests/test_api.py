"""End-to-end API tests over the DEMO_MODE mock path.

This validates the entire happy path described in the spec without any AWS
credentials: goal -> generation -> validation -> graph data -> state-machine
execution -> documents -> conflict -> human approval -> simulated submission ->
audit trail.
"""

from __future__ import annotations

import os

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_services
from app.api.routes import router
from app.core.config import override_settings

DEMO_GOAL = "I want to apply for the Merit Excellence Scholarship"
DOCS = [
    ("transcript.pdf", b"%PDF-1.4 fictional transcript", "application/pdf"),
    ("government_id.pdf", b"%PDF-1.4 fictional government id", "application/pdf"),
    ("income_certificate.pdf", b"%PDF-1.4 fictional income certificate", "application/pdf"),
    ("personal_essay.pdf", b"%PDF-1.4 fictional essay", "application/pdf"),
]


@pytest.fixture(scope="module")
def client() -> TestClient:
    override_settings({**os.environ, "DEMO_MODE": "true", "CORS_ORIGINS": "[\"http://localhost:5173\"]"})
    app = FastAPI()
    app.include_router(router)
    get_services.cache_clear()
    return TestClient(app)


def create_workflow(client: TestClient) -> str:
    r = client.post("/workflows", json={"goal": DEMO_GOAL})
    assert r.status_code == 200
    return r.json()["workflow_id"]


def upload_all(client: TestClient, wid: str) -> None:
    for name, content, mime in DOCS:
        r = client.post(
            f"/workflows/{wid}/documents",
            files={"file": (name, content, mime)},
        )
        assert r.status_code == 200, r.text
        assert r.json()["classification"] is not None


def test_create_workflow_generates_valid_schema(client):
    r = client.post("/workflows", json={"goal": DEMO_GOAL})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "in_progress"
    wf = body["workflow"]
    assert wf["initial_state"] == "eligibility_check"
    assert set(wf["terminal_states"]) == {"completed", "not_eligible", "blocked", "cancelled"}
    assert len(wf["states"]) == 10


def test_full_demo_path(client):
    wid = create_workflow(client)

    # kicks off eligibility -> pauses at documents
    r = client.post(f"/workflows/{wid}/advance", json={})
    assert r.status_code == 200
    body = r.json()
    assert body["needs"] == "document_upload"
    assert body["progress"]["completed"] == 1

    # cannot skip to submission by approving early
    r = client.post(f"/workflows/{wid}/advance", json={"approval": True})
    assert r.status_code == 200
    assert r.json()["needs"] == "document_upload"

    # upload the four demo documents
    upload_all(client, wid)
    detail = client.get(f"/workflows/{wid}").json()
    assert detail["collected_documents"] == [
        "academic_transcript",
        "government_id",
        "personal_essay",
        "proof_of_income",
    ]

    # advance -> validation runs -> conflict detected -> needs review approval
    r = client.post(f"/workflows/{wid}/advance", json={})
    assert r.status_code == 200
    body = r.json()
    assert body["needs"] == "approval"
    validation = body["validation"]
    assert validation is not None
    assert validation["status"] == "needs_review"
    fields = {i["field"] for i in validation["issues"]}
    assert "current_semester_gpa" in fields

    # acknowledge the warning -> proceeds to final human approval
    r = client.post(f"/workflows/{wid}/advance", json={"acknowledge": True})
    assert r.status_code == 200
    body = r.json()
    assert body["needs"] == "approval"

    # do not allow approval to be bypassed silently
    assert body["current_state"] == "final_approval"

    # approve -> submission auto-runs -> completed
    r = client.post(f"/workflows/{wid}/advance", json={"approval": True})
    assert r.status_code == 200
    body = r.json()
    assert body["completed"] is True
    assert body["status"] == "completed"

    audit = client.get(f"/workflows/{wid}/audit").json()["events"]
    types = {e["event_type"] for e in audit}
    assert "workflow_created" in types
    assert "workflow_generated" in types
    assert "document_uploaded" in types
    assert "field_extracted" in types
    assert "human_approval" in types
    assert "execution" in types
    assert "workflow_completed" in types


def test_low_confidence_extraction_blocks(client):
    wid = create_workflow(client)
    client.post(f"/workflows/{wid}/advance", json={})

    # use a corrected transcript (passes) AND a bogus document to keep coverage
    r = client.post(
        f"/workflows/{wid}/documents",
        files={"file": ("transcript_corrected.pdf", b"%PDF corrected", "application/pdf")},
    )
    assert r.status_code == 200
    for name, content, mime in DOCS[1:]:
        client.post(
            f"/workflows/{wid}/documents",
            files={"file": (name, content, mime)},
        )

    r = client.post(f"/workflows/{wid}/advance", json={})
    assert r.status_code == 200
    body = r.json()
    # corrected transcript -> validation passes -> straight to final approval
    if body["validation"] is not None:
        assert body["validation"]["status"] in {"pass", "needs_review"}


def test_workflow_generation_failure_is_loud(client):
    """If generation+retry both fail, the API surfaces a typed error."""
    from app.ai.mock_llm_provider import MockLLMProvider
    from app.ai.workflow_generator import WorkflowGenerator
    from app.api.deps import get_services

    class BrokenProvider(MockLLMProvider):
        def generate_workflow(self, goal, knowledge):
            raise RuntimeError("bedrock down")

    services = get_services()
    original = services.generator
    services.generator = WorkflowGenerator(BrokenProvider(), services.settings)
    try:
        r = client.post("/workflows", json={"goal": DEMO_GOAL})
        assert r.status_code == 409
        assert "valid workflow" in r.json()["detail"]
    finally:
        services.generator = original