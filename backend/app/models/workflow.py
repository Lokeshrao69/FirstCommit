"""Pydantic models for the workflow contract.

A workflow is a validated, executable state machine definition generated from a
natural-language goal. The LLM produces the PLAN; this schema is the strict contract
it must satisfy before being executed.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .enums import StateStatus, StateType, WorkflowStatus


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Transition(BaseModel):
    """A deterministic edge. `condition` names a known predicate evaluated at
    runtime by the state machine; the LLM cannot inject arbitrary code."""

    model_config = ConfigDict(extra="forbid")

    target: str = Field(description="id of the destination state")
    condition: str = Field(description="name of a registered transition condition")


class ValidationRule(BaseModel):
    """A declarative, deterministic rule evaluated by the validation handler."""

    model_config = ConfigDict(extra="forbid")

    field: str
    operator: Literal["gte", "lte", "gt", "lt", "eq", "ne", "in", "not_in", "contains", "required"]
    value: Optional[Any] = None
    message: Optional[str] = None


class State(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    label: str
    type: StateType
    description: str = ""
    required_data: list[str] = Field(default_factory=list)
    required_documents: list[str] = Field(default_factory=list)
    validation_rules: list[ValidationRule] = Field(default_factory=list)
    transitions: list[Transition] = Field(default_factory=list)
    confidence_threshold: float = 0.85
    status: StateStatus = StateStatus.PENDING

    @model_validator(mode="after")
    def _check_confidence(self) -> "State":
        if not (0.0 <= self.confidence_threshold <= 1.0):
            raise ValueError("confidence_threshold must be between 0 and 1")
        if self.type == StateType.TERMINAL and self.transitions:
            raise ValueError("terminal states cannot have outgoing transitions")
        return self


class Workflow(BaseModel):
    """Top-level workflow definition (schema shown in docs/workflow-engine.md)."""

    model_config = ConfigDict(extra="forbid")

    workflow_id: str
    goal: str
    initial_state: str
    terminal_states: list[str]
    states: list[State]
    status: WorkflowStatus = WorkflowStatus.CREATED
    current_state: Optional[str] = None
    collected_data: dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)

    def state_map(self) -> dict[str, State]:
        return {s.id: s for s in self.states}

    def get_state(self, state_id: str) -> Optional[State]:
        return self.state_map().get(state_id)

    def touch(self) -> None:
        self.updated_at = utc_now()