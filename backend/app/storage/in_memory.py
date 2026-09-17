"""In-memory repository used for DEMO_MODE/local development and tests."""

from __future__ import annotations

from collections import defaultdict
from typing import DefaultDict

from ..models.audit import AuditEvent
from ..models.document import DocumentRecord
from ..models.workflow import Workflow
from .repository import WorkflowRepository


class InMemoryRepository(WorkflowRepository):
    def __init__(self) -> None:
        self._workflows: dict[str, Workflow] = {}
        self._documents: DefaultDict[str, dict[str, DocumentRecord]] = defaultdict(dict)
        self._audit: DefaultDict[str, list[AuditEvent]] = defaultdict(list)

    def save_workflow(self, workflow: Workflow) -> None:
        self._workflows[workflow.workflow_id] = workflow

    def get_workflow(self, workflow_id: str) -> Workflow | None:
        return self._workflows.get(workflow_id)

    def save_document(self, doc: DocumentRecord) -> None:
        self._documents[doc.workflow_id][doc.document_id] = doc

    def get_document(self, workflow_id: str, document_id: str) -> DocumentRecord | None:
        return self._documents[workflow_id].get(document_id)

    def list_documents(self, workflow_id: str) -> list[DocumentRecord]:
        return list(self._documents[workflow_id].values())

    def append_audit(self, event: AuditEvent) -> None:
        self._audit[event.workflow_id].append(event)

    def list_audit(self, workflow_id: str) -> list[AuditEvent]:
        return list(self._audit[workflow_id])