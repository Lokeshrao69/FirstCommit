"""API request/response models (contract-first; frontend can build against mocks)."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from .enums import WorkflowStatus


class CreateWorkflowRequest(BaseModel):
    goal: str = Field(min_length=3, max_length=500)


class CreateWorkflowResponse(BaseModel):
    workflow_id: str
    status: WorkflowStatus
    workflow: dict[str, Any]


class AdvanceWorkflowRequest(BaseModel):
    """Payload accepted by POST /workflows/{id}/advance.

    Only the field relevant to the current gated state is consumed; other fields are
    ignored by the deterministic executor.
    """

    model_config = ConfigDict(extra="forbid")

    user_input: dict[str, Any] = Field(default_factory=dict)
    approval: Optional[bool] = None
    acknowledge: Optional[bool] = None
    confirm: Optional[bool] = None
    document_id: Optional[str] = None


class WorkflowProgress(BaseModel):
    completed: int
    total: int
    ratio: float = Field(ge=0.0, le=1.0)


class WorkflowDetailResponse(BaseModel):
    workflow_id: str
    status: WorkflowStatus
    goal: str
    current_state: Optional[str]
    last_message: Optional[str] = None
    needs: Optional[str] = None
    progress: WorkflowProgress
    states: list[dict[str, Any]]
    collected_documents: list[str] = Field(default_factory=list)
    validation: Optional[dict[str, Any]] = None


class DocumentUploadResponse(BaseModel):
    document_id: str
    filename: str
    classification: Optional[str] = None
    confidence: Optional[float] = None
    extracted_fields: dict[str, Any] = Field(default_factory=dict)
    validation_status: Optional[str] = None
    issues: list[dict[str, Any]] = Field(default_factory=list)
    message: str = ""