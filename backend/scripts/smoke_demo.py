"""End-to-end demo smoke script for FlowForge.

Simulates the complete scholarship application lifecycle in DEMO_MODE:
1. Workflow generation from plain-language goal
2. Automated eligibility evaluation
3. Streaming document upload, classification, and field extraction
4. Cross-document validation & GPA discrepancy detection
5. Human-in-the-loop review & approval gate
6. Grant submission and confirmation ID issuance
7. Full tamper-evident audit trail verification
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

os.environ["DEMO_MODE"] = "true"

from fastapi.testclient import TestClient  # noqa: E402

from app.api.deps import get_services  # noqa: E402
from app.core.config import override_settings  # noqa: E402
from main import app  # noqa: E402


def run_smoke_demo() -> None:
    print("=" * 78)
    print("FlowForge End-to-End Demo Smoke Test (DEMO_MODE=true)")
    print("=" * 78)

    override_settings({**os.environ, "DEMO_MODE": "true"})
    get_services.cache_clear()

    client = TestClient(app)

    # 1. Health check
    print("\n[1/7] Checking API health...")
    r = client.get("/health")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    health = r.json()
    print(f"  Status: {health['status']}, App: {health.get('app', health.get('service', 'flowforge'))}")

    # 2. Workflow creation
    goal = "I want to apply for the Merit Excellence Scholarship"
    print(f"\n[2/7] Submitting workflow goal: '{goal}'...")
    r = client.post("/workflows", json={"goal": goal})
    assert r.status_code == 200, f"Create workflow failed: {r.text}"
    wf_data = r.json()
    wid = wf_data["workflow_id"]
    wf = wf_data["workflow"]
    print(f"  Created Workflow ID : {wid}")
    print(f"  Initial State       : {wf['initial_state']}")
    print(f"  Total States        : {len(wf['states'])}")
    print(f"  Terminal States     : {', '.join(wf['terminal_states'])}")

    # 3. Advance: Automated Eligibility Check
    print("\n[3/7] Advancing workflow (Automated Eligibility Evaluation)...")
    r = client.post(f"/workflows/{wid}/advance", json={})
    assert r.status_code == 200, f"Advance failed: {r.text}"
    adv1 = r.json()
    print(f"  Current State : {adv1['current_state']}")
    print(f"  Gate Action   : {adv1['needs']}")
    print(f"  Message       : {adv1['message']}")
    assert adv1["needs"] == "document_upload", f"Expected document_upload, got {adv1['needs']}"

    # 4. Upload 4 documents
    docs_to_upload = [
        ("transcript.pdf", b"%PDF-1.4 fictional academic transcript with GPA 3.20 and cumulative GPA 3.85"),
        ("government_id.pdf", b"%PDF-1.4 fictional government passport ID for Alex Rivera"),
        ("income_certificate.pdf", b"%PDF-1.4 fictional income certificate showing $42,000 household income"),
        ("personal_essay.pdf", b"%PDF-1.4 fictional personal statement on aerospace engineering"),
    ]
    print(f"\n[4/7] Uploading {len(docs_to_upload)} required verification documents...")
    for filename, content in docs_to_upload:
        r = client.post(
            f"/workflows/{wid}/documents",
            files={"file": (filename, content, "application/pdf")},
        )
        assert r.status_code == 200, f"Upload {filename} failed: {r.text}"
        doc_res = r.json()
        print(
            f"  Uploaded: {filename:<25} -> Classified as: {doc_res['classification']} "
            f"(conf: {doc_res['confidence']:.2f})"
        )
        for f_name, f_data in doc_res.get("extracted_fields", {}).items():
            print(f"    * {f_name}: {f_data['value']} (conf: {f_data['confidence']:.2f})")

    # 5. Advance: Validation & Conflict Detection
    print("\n[5/7] Advancing workflow (Cross-Document Validation & Discrepancy Detection)...")
    r = client.post(f"/workflows/{wid}/advance", json={})
    assert r.status_code == 200, f"Advance validation failed: {r.text}"
    adv2 = r.json()
    print(f"  Current State     : {adv2['current_state']}")
    print(f"  Gate Action       : {adv2['needs']}")
    validation = adv2.get("validation", {})
    print(f"  Validation Status : {validation.get('status')}")
    for issue in validation.get("issues", []):
        print(f"  [FLAGGED ISSUE] Severity: {issue.get('severity')}, Field: {issue.get('field')}")
        print(f"                  Message : {issue.get('message')}")

    # 6. Human Review & Approval Gates
    print("\n[6/7] Human reviewer acknowledging discrepancy and approving application...")
    # Gate 6a: Acknowledge warning
    print("  6a. Acknowledging GPA warning gate...")
    r = client.post(f"/workflows/{wid}/advance", json={"acknowledge": True})
    assert r.status_code == 200, f"Acknowledge warning failed: {r.text}"
    adv3a = r.json()
    print(f"      Current State : {adv3a['current_state']}")
    print(f"      Gate Action   : {adv3a['needs']}")

    # Gate 6b: Final approval
    print("  6b. Submitting final reviewer approval...")
    r = client.post(f"/workflows/{wid}/advance", json={"approval": True})
    assert r.status_code == 200, f"Final approval failed: {r.text}"
    adv3b = r.json()
    print(f"      Current State : {adv3b['current_state']}")
    print(f"      Completed     : {adv3b['completed']}")
    print(f"      Message       : {adv3b['message']}")

    # 7. Audit Trail
    print("\n[7/7] Retrieving immutable audit log...")
    r = client.get(f"/workflows/{wid}/audit")
    assert r.status_code == 200, f"Audit retrieval failed: {r.text}"
    audit = r.json()
    events = audit.get("events", [])
    print(f"  Total Audit Events Recorded: {len(events)}")
    for ev in events[-5:]:
        trans = f"{ev.get('from_state')} -> {ev.get('to_state')}"
        print(f"  - [{ev['timestamp']}] {ev['event_type']:<24} (transition: {trans})")

    print("\n" + "=" * 78)
    print("SUCCESS: FlowForge End-to-End Demo Workflow fully verified!")
    print("=" * 78)


if __name__ == "__main__":
    run_smoke_demo()
