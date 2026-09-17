"""Audit logging for workflow events.

Every meaningful event (creation, generation, transitions, document processing,
AI decisions, human approvals, execution) is recorded and can be replayed through
GET /workflows/{id}/audit.
"""

from __future__ import annotations

from typing import Any, Optional

from ..models.audit import AuditEvent
from ..models.enums import AuditEventType


class AuditLogger:
    def __init__(self, workflow_id: str) -> None:
        self._workflow_id = workflow_id

    def log(
        self,
        event_type: AuditEventType,
        *,
        from_state: Optional[str] = None,
        to_state: Optional[str] = None,
        confidence: Optional[float] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> AuditEvent:
        return AuditEvent(
            workflow_id=self._workflow_id,
            event_type=event_type,
            from_state=from_state,
            to_state=to_state,
            confidence=confidence,
            details=details or {},
        )


def new_logger(workflow_id: str) -> AuditLogger:
    return AuditLogger(workflow_id)
