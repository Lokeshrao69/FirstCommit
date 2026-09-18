"""Shared enums for FlowForge domain models."""

from enum import Enum


class StateType(str, Enum):
    AUTOMATIC = "automatic"
    USER_INPUT = "user_input"
    DOCUMENT_REQUIRED = "document_required"
    VALIDATION = "validation"
    HUMAN_APPROVAL = "human_approval"
    EXECUTION = "execution"
    TERMINAL = "terminal"

    @property
    def is_gated(self) -> bool:
        """State types that pause execution waiting for a human."""
        return self in {
            StateType.USER_INPUT,
            StateType.DOCUMENT_REQUIRED,
            StateType.HUMAN_APPROVAL,
        }


class StateStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    WARNING = "warning"
    BLOCKED = "blocked"
    FAILED = "failed"
    SKIPPED = "skipped"


class WorkflowStatus(str, Enum):
    CREATED = "created"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    GENERATION_FAILED = "generation_failed"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class DocumentStatus(str, Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    CLASSIFIED = "classified"
    EXTRACTED = "extracted"
    VALIDATED = "validated"
    FAILED = "failed"


class ValidationSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class ValidationStatus(str, Enum):
    PASS = "pass"
    NEEDS_REVIEW = "needs_review"
    BLOCK = "block"


class AuditEventType(str, Enum):
    WORKFLOW_CREATED = "workflow_created"
    WORKFLOW_GENERATED = "workflow_generated"
    WORKFLOW_VALIDATED = "workflow_validated"
    STATE_ACTIVATED = "state_activated"
    STATE_TRANSITION = "state_transition"
    DOCUMENT_UPLOADED = "document_uploaded"
    DOCUMENT_CLASSIFIED = "document_classified"
    FIELD_EXTRACTED = "field_extracted"
    VALIDATION_RESULT = "validation_result"
    AI_DECISION = "ai_decision"
    HUMAN_APPROVAL = "human_approval"
    EXECUTION = "execution"
    ERROR = "error"
    WORKFLOW_COMPLETED = "workflow_completed"
    DOCUMENTS_PURGED = "documents_purged"


CONFIDENCE_PASS = 0.85
CONFIDENCE_WARN = 0.60
