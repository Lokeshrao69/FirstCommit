"""Domain errors for the workflow engine."""


class FlowForgeError(Exception):
    """Base error."""


class WorkflowValidationError(FlowForgeError):
    """Raised when an LLM-generated (or mocked) workflow fails validation."""

    def __init__(self, message: str, errors: list[str] | None = None) -> None:
        super().__init__(message)
        self.errors = errors or [message]


class InvalidTransitionError(FlowForgeError):
    """Raised when the executor is asked to make an illegal transition."""


class ExecutionError(FlowForgeError):
    """Raised when a state cannot be executed (missing handler, bad payload)."""


class WorkflowAlreadyTerminalError(FlowForgeError):
    """Raised when advance is called on a finished workflow."""


class DocumentProcessingError(FlowForgeError):
    """Raised when a document cannot be reliably processed."""


class WorkflowGenerationError(FlowForgeError):
    """Raised after generation+retry fails to produce a valid workflow."""


class WorkflowNotFound(FlowForgeError):
    """Raised when a requested workflow does not exist."""