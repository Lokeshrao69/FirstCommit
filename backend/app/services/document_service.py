"""Document pipeline orchestration.

upload -> store -> extract text -> classify -> extract fields -> persist.
Cross-document validation runs later at the `validation` state (workflow_service).

Storage hardening (4C): records keep both the object key (`storage_key`) and the
storage URI (`s3_key`); failed processing deletes stored bytes best-effort; and
`purge_workflow_documents` removes bytes for a finished workflow, marking each
record's `purged_at`.
"""

from __future__ import annotations

import logging
import uuid
from typing import Optional

from ..ai.llm_provider import LLMProvider
from ..core.observability import log_event
from ..documents.processor import DocumentObjectStore, DocumentProcessor
from ..models.document import DocumentRecord
from ..models.enums import DocumentStatus
from ..storage.repository import WorkflowRepository

logger = logging.getLogger(__name__)


def record_key(doc: DocumentRecord) -> Optional[str]:
    """Return the raw object key to operate on for a DocumentRecord.

    Uses `storage_key` when present, otherwise unwraps legacy storage URIs from
    `s3_key`: `s3://bucket/key` -> `key`, `mock://key` -> `key`. A bare key is
    returned unchanged; documents without stored bytes return None.
    """
    value = doc.storage_key or doc.s3_key
    if not value:
        return None
    if value.startswith("s3://"):
        parts = value[len("s3://") :].split("/", 1)
        return parts[1] if len(parts) == 2 else None
    if value.startswith("mock://"):
        return value[len("mock://") :] or None
    return value


class DocumentService:
    def __init__(
        self,
        repo: WorkflowRepository,
        store: DocumentObjectStore,
        processor: DocumentProcessor,
        llm: LLMProvider,
        object_key_fn,
    ) -> None:
        self._repo = repo
        self._store = store
        self._processor = processor
        self._llm = llm
        self._object_key_fn = object_key_fn

    def process_upload(
        self,
        workflow_id: str,
        filename: str,
        mime_type: str,
        content: bytes,
    ) -> DocumentRecord:
        document_id = f"doc_{uuid.uuid4().hex[:12]}"
        doc = DocumentRecord(
            workflow_id=workflow_id,
            document_id=document_id,
            filename=filename,
            mime_type=mime_type,
            status=DocumentStatus.PROCESSING,
        )
        self._repo.save_document(doc)

        try:
            key = self._object_key_fn(workflow_id, filename)
            doc.s3_key = self._store.put(key, content, mime_type)
            doc.storage_key = key

            text = self._processor.extract_text(content, filename, mime_type, storage_uri=doc.s3_key)
            classification = self._llm.classify_document(text)
            doc.classification = classification.classification
            doc.classification_confidence = classification.confidence
            doc.status = DocumentStatus.CLASSIFIED
            self._repo.save_document(doc)

            fields = self._llm.extract_fields(text, classification.classification)
            doc.extracted_fields = fields
            doc.status = DocumentStatus.EXTRACTED
            doc.processed_at = _now()
            self._repo.save_document(doc)

            log_event(
                "document_processed",
                workflow_id=workflow_id,
                document_id=document_id,
                classification=doc.classification,
                status=doc.status.value,
            )

            return doc
        except Exception as exc:  # noqa: BLE001 - normalized to a stable error
            doc.status = DocumentStatus.FAILED
            self._repo.save_document(doc)
            self._delete_best_effort(doc)

            log_event(
                "error",
                component="document_service",
                workflow_id=workflow_id,
                document_id=document_id,
                error_type=type(exc).__name__,
                message=str(exc),
            )

            raise DocumentProcessingException(str(exc)) from exc

    def purge_workflow_documents(self, workflow_id: str) -> int:
        """Delete stored bytes for every document of a finished workflow.

        Best-effort per document: a storage failure is logged and does not abort
        the other deletions. Returns the number of records marked purged.
        """
        purged = 0
        for doc in self._repo.list_documents(workflow_id):
            key = record_key(doc)
            if not key:
                continue
            try:
                self._store.delete(key)
            except Exception as exc:  # noqa: BLE001 - best effort cleanup
                logger.warning(
                    "purge failed for workflow=%s document=%s key=%s: %s",
                    workflow_id,
                    doc.document_id,
                    key,
                    exc,
                )
                continue
            doc.purged_at = _now()
            self._repo.save_document(doc)
            purged += 1
            log_event(
                "document_purged",
                workflow_id=workflow_id,
                document_id=doc.document_id,
                storage_key=key,
            )
        log_event(
            "documents_purged",
            workflow_id=workflow_id,
            purged_count=purged,
        )
        return purged

    def _delete_best_effort(self, doc: DocumentRecord) -> None:
        key = record_key(doc)
        if not key:
            return
        try:
            self._store.delete(key)
            logger.info("deleted stored bytes for failed document %s (%s)", doc.document_id, key)
        except Exception as exc:  # noqa: BLE001 - best effort cleanup
            logger.warning(
                "failed to delete stored bytes for document %s key=%s: %s",
                doc.document_id,
                key,
                exc,
            )


def _now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


class DocumentProcessingException(Exception):
    pass
