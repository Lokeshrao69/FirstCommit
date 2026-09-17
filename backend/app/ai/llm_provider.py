"""AI component interfaces.

The application depends on these interfaces, not on a specific model vendor.
`MockLLMProvider` backs demo mode / tests; `BedrockProvider` is the real AWS
implementation. Controlled AI components only — no autonomous agents.
"""

from __future__ import annotations

from typing import Protocol

from ..models.document import (
    ClassificationResult,
    CrossValidationResult,
    ExtractedField,
)


class LLMProvider(Protocol):
    """Controlled LLM operations. Each method returns typed data."""

    def generate_workflow(self, goal: str, knowledge: dict) -> dict:
        """Return raw, structured workflow JSON for `goal`."""
        ...

    def classify_document(self, text: str) -> ClassificationResult:
        """Classify extracted document text into a document category."""
        ...

    def extract_fields(self, text: str, classification: str) -> dict[str, ExtractedField]:
        """Extract structured fields for a known classification."""
        ...

    def run_cross_validation(
        self,
        requirements: dict,
        extracted_fields: dict[str, dict[str, ExtractedField]],
    ) -> CrossValidationResult:
        """Cross-check all extracted documents against workflow requirements."""
        ...

    def name(self) -> str:
        ...
