"""Workflow generation orchestration.

Plan -> validate -> retry once -> fail loudly. An unvalidated workflow is never
executed. In DEMO_MODE or when generation fails, the canonical demo workflow
(knowledge/scholarship_process.json) is returned as a documented fallback.
"""

from __future__ import annotations

import json

from ..core.config import Settings
from ..models.workflow import Workflow
from ..workflow.errors import WorkflowGenerationError
from ..workflow.schema_validator import validate_or_raise
from .llm_provider import LLMProvider


class WorkflowGenerator:
    def __init__(self, provider: LLMProvider, settings: Settings) -> None:
        self._provider = provider
        self._settings = settings

    def generate(self, goal: str, knowledge: dict) -> Workflow:
        last_error: Exception | None = None
        for attempt in range(2):
            try:
                raw = self._provider.generate_workflow(goal, knowledge)
                return self._build(raw)
            except WorkflowGenerationError:
                raise
            except Exception as exc:  # noqa: BLE001 - normalized below
                last_error = exc
                if not self._settings.workflow_retry_on_invalid:
                    break
        raise WorkflowGenerationError(
            f"could not generate a valid workflow for goal after retry: {last_error}"
        )

    def _build(self, raw: dict) -> Workflow:
        workflow = Workflow.model_validate(raw)
        validate_or_raise(workflow)
        return workflow


def load_knowledge(path: str) -> dict:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def load_canonical_workflow(path: str) -> Workflow:
    with open(path, encoding="utf-8") as fh:
        raw = json.load(fh)
    workflow = Workflow.model_validate(raw)
    validate_or_raise(workflow)
    return workflow