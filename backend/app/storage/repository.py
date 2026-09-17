"""Persistence interfaces + implementations.

Business logic depends on these interfaces, not on AWS. Local development uses
InMemoryRepository; deployment uses DynamoRepository.
"""

from __future__ import annotations

from ..models.audit import AuditEvent
from ..models.document import DocumentRecord
from ..models.workflow import Workflow


class WorkflowRepository:
    def save_workflow(self, workflow: Workflow) -> None:
        raise NotImplementedError

    def get_workflow(self, workflow_id: str) -> Workflow | None:
        raise NotImplementedError

    def save_document(self, doc: DocumentRecord) -> None:
        raise NotImplementedError

    def get_document(self, workflow_id: str, document_id: str) -> DocumentRecord | None:
        raise NotImplementedError

    def list_documents(self, workflow_id: str) -> list[DocumentRecord]:
        raise NotImplementedError

    def append_audit(self, event: AuditEvent) -> None:
        raise NotImplementedError

    def list_audit(self, workflow_id: str) -> list[AuditEvent]:
        raise NotImplementedError