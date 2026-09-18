"""Storage-key and document-purge tests (section 4C).

Covers `storage_key` vs legacy `s3_key` URIs, `record_key`, best-effort delete on
failed processing, and the purge callback firing on every terminal status with
its audit event and `purged_at` markers.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.api.deps import Services
from app.core.config import Settings
from app.documents.mock_processor import MockDocumentProcessor, MockObjectStore
from app.models.api import AdvanceWorkflowRequest
from app.models.document import DocumentRecord
from app.models.enums import AuditEventType, DocumentStatus
from app.services.document_service import (
    DocumentProcessingException,
    DocumentService,
    record_key,
)
from app.storage.in_memory import InMemoryRepository

GOAL = "I want to apply for the Merit Excellence Scholarship"
DOCS = [
    ("transcript.pdf", b"%PDF-1.4 fictional transcript", "application/pdf"),
    ("government_id.pdf", b"%PDF-1.4 fictional government id", "application/pdf"),
    ("income_certificate.pdf", b"%PDF-1.4 fictional income certificate", "application/pdf"),
    ("personal_essay.pdf", b"%PDF-1.4 fictional essay", "application/pdf"),
]

_DEMO_ENV = {
    "DEMO_MODE": "true",
    "MOCK_LLM": "false",
    "ALLOW_MOCK_FALLBACK": "false",
    "PURGE_DOCUMENTS_ON_COMPLETION": "true",
}


def _services(**overrides) -> Services:
    return Services(Settings({**_DEMO_ENV, **overrides}))


def _run_to_terminal(svc: Services, approve: bool) -> str:
    wid = svc.workflow_service.create_workflow(GOAL).workflow_id
    svc.workflow_service.advance(wid, AdvanceWorkflowRequest())
    for name, content, mime in DOCS:
        svc.document_service.process_upload(wid, name, mime, content)
    svc.workflow_service.advance(wid, AdvanceWorkflowRequest())
    svc.workflow_service.advance(wid, AdvanceWorkflowRequest(acknowledge=True))
    svc.workflow_service.advance(wid, AdvanceWorkflowRequest(approval=approve))
    return wid


# ---------------------------------------------------------------- record_key


def _doc(**fields) -> DocumentRecord:
    defaults = {
        "workflow_id": "wf_x",
        "document_id": "doc_x",
        "filename": "x.pdf",
        "mime_type": "application/pdf",
        "status": DocumentStatus.PROCESSING,
    }
    defaults.update(fields)
    return DocumentRecord(**defaults)


def test_record_key_prefers_storage_key():
    doc = _doc(storage_key="uploads/wf_x/abc.pdf", s3_key="mock://uploads/wf_x/abc.pdf")
    assert record_key(doc) == "uploads/wf_x/abc.pdf"


def test_record_key_unwraps_legacy_s3_uri():
    doc = _doc(storage_key=None, s3_key="s3://flowforge-documents/uploads/wf_x/abc.pdf")
    assert record_key(doc) == "uploads/wf_x/abc.pdf"


def test_record_key_unwraps_legacy_mock_uri():
    doc = _doc(storage_key=None, s3_key="mock://uploads/wf_x/abc.pdf")
    assert record_key(doc) == "uploads/wf_x/abc.pdf"


def test_record_key_returns_bare_key():
    doc = _doc(storage_key=None, s3_key="uploads/wf_x/abc.pdf")
    assert record_key(doc) == "uploads/wf_x/abc.pdf"


def test_record_key_is_none_without_stored_bytes():
    doc = _doc(storage_key=None, s3_key=None)
    assert record_key(doc) is None


# ------------------------------------------------------------- upload storage


class _RecordingStore(MockObjectStore):
    def __init__(self) -> None:
        super().__init__()
        self.deleted: list[str] = []

    def delete(self, key: str) -> None:
        self.deleted.append(key)
        super().delete(key)


def _document_service(store: MockObjectStore | None = None) -> DocumentService:
    return DocumentService(
        repo=InMemoryRepository(),
        store=store or MockObjectStore(),
        processor=MockDocumentProcessor(),
        llm=MagicalLLM(),
        object_key_fn=lambda wf, name: f"uploads/{wf}/{name}",
    )


class MagicalLLM:
    def classify_document(self, text):
        from app.models.document import ClassificationResult

        return ClassificationResult(classification="academic_transcript", confidence=0.99)

    def extract_fields(self, text, classification):
        return {}


def test_process_upload_records_both_keys():
    service = _document_service()
    doc = service.process_upload("wf_x", "transcript.pdf", "application/pdf", b"%PDF-1.4 x")
    assert doc.storage_key == "uploads/wf_x/transcript.pdf"
    assert doc.s3_key == "mock://uploads/wf_x/transcript.pdf"
    assert doc.purged_at is None

    stored = service._repo.get_document("wf_x", doc.document_id)
    assert stored is not None
    assert stored.storage_key == doc.storage_key
    assert stored.s3_key == doc.s3_key


def test_failed_processing_deletes_stored_bytes():
    class BrokenProcessor(MockDocumentProcessor):
        def extract_text(self, content, filename, mime_type):
            raise RuntimeError("parsing blew up")

    store = _RecordingStore()
    service = DocumentService(
        repo=InMemoryRepository(),
        store=store,
        processor=BrokenProcessor(),
        llm=MagicalLLM(),
        object_key_fn=lambda wf, name: f"uploads/{wf}/{name}",
    )
    with pytest.raises(DocumentProcessingException):
        service.process_upload("wf_x", "transcript.pdf", "application/pdf", b"%PDF-1.4 x")
    assert store.deleted == ["uploads/wf_x/transcript.pdf"]
    assert list(store._blobs) == []


def test_purge_workflow_documents_marks_records():
    store = _RecordingStore()
    service = _document_service(store)
    docs = [
        service.process_upload("wf_x", name, mime, content)
        for name, content, mime in DOCS
    ]
    assert len(store._blobs) == 4

    purged = service.purge_workflow_documents("wf_x")
    assert purged == 4
    assert len(store.deleted) == 4
    assert list(store._blobs) == []
    for doc in docs:
        assert service._repo.get_document("wf_x", doc.document_id).purged_at is not None


# ----------------------------------------------------- purge-on-terminal wiring


def test_completion_purges_documents_and_audits():
    svc = _services()
    wid = _run_to_terminal(svc, approve=True)

    docs = svc.repo.list_documents(wid)
    assert len(docs) == len(DOCS)
    assert all(d.purged_at for d in docs)
    assert not getattr(svc.store, "_blobs", None)

    events = svc.repo.list_audit(wid)
    purge_events = [e for e in events if e.event_type == AuditEventType.DOCUMENTS_PURGED]
    assert len(purge_events) == 1
    assert purge_events[0].details["purged_count"] == len(DOCS)


def test_cancellation_purges_documents():
    svc = _services()
    wid = _run_to_terminal(svc, approve=False)

    assert svc.repo.get_workflow(wid).status.value == "cancelled"
    docs = svc.repo.list_documents(wid)
    assert all(d.purged_at for d in docs)
    assert not getattr(svc.store, "_blobs", None)
    events = svc.repo.list_audit(wid)
    assert any(e.event_type == AuditEventType.DOCUMENTS_PURGED for e in events)


def test_purge_can_be_disabled():
    svc = _services(PURGE_DOCUMENTS_ON_COMPLETION="false")
    wid = _run_to_terminal(svc, approve=True)

    docs = svc.repo.list_documents(wid)
    assert all(d.purged_at is None for d in docs)
    events = svc.repo.list_audit(wid)
    assert not any(e.event_type == AuditEventType.DOCUMENTS_PURGED for e in events)


def test_s3_delete_failures_are_logged_not_silent():
    s3 = MagicMock()
    s3.delete_object.side_effect = RuntimeError("denied")
    from app.documents.aws_processor import S3ObjectStore

    store = S3ObjectStore("bucket", "us-east-1", client=s3)
    store.delete("uploads/wf/key.pdf")
    s3.delete_object.assert_called_once_with(Bucket="bucket", Key="uploads/wf/key.pdf")
