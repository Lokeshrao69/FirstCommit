"""Deterministic mock LLM provider for DEMO_MODE and tests.

Implements the same contracts as the Bedrock provider so the demo is fully
functional offline. No model calls happen here. Also used as the documented
fallback if Bedrock fails during a live demo.

Classification and field extraction are derived from the knowledge catalog
(`knowledge/document_types.json`), so the demo corpus and the mock stay coupled
to the same reference data. The cross-validation side is an advisory-only
pass-through: the deterministic rules engine owns pass/needs-review/block.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from ..core.confidence import clamped
from ..models.document import (
    ClassificationResult,
    CrossValidationResult,
    ExtractedField,
    ValidationStatus,
)
from .llm_provider import LLMProvider

_DEFAULT_KNOWLEDGE = Path(__file__).resolve().parents[2] / "knowledge" / "document_types.json"

# classification -> (line label prefix, field key, confidence)
_EXTRACTORS: dict[str, list[tuple[str, str, float]]] = {
    "aadhaar": [
        ("Aadhaar Number", "aadhaar_number", 0.98),
        ("Name", "full_name", 0.97),
        ("Date of Birth", "date_of_birth", 0.97),
        ("Gender", "gender", 0.95),
        ("Address", "address", 0.95),
    ],
    "income_certificate": [
        ("Certificate No", "certificate_number", 0.9),
        ("Name", "full_name", 0.96),
        ("Father's Name", "father_name", 0.95),
        ("Address", "address", 0.95),
        ("Annual Family Income", "annual_family_income", 0.95),
        ("Income Reference Period", "income_reference_period", 0.9),
        ("Date of Issue", "issued_date", 0.95),
        ("Valid Until", "valid_until", 0.96),
    ],
    "marks_memo": [
        ("Name", "full_name", 0.97),
        ("Father's Name", "father_name", 0.95),
        ("Enrollment No", "roll_number", 0.95),
        ("Board / University", "board_or_university", 0.95),
        ("Institution", "institution", 0.95),
        ("Examination", "examination", 0.95),
        ("Year of Passing", "year_of_passing", 0.95),
        ("Percentage / CGPA", "percentage", 0.93),
        ("Result", "result", 0.93),
    ],
    "bonafide_certificate": [
        ("Name", "full_name", 0.97),
        ("Father's Name", "father_name", 0.95),
        ("Institution", "institution", 0.95),
        ("Course", "course", 0.96),
        ("Year of Study", "year_of_study", 0.94),
        ("Admission / Roll No", "roll_number", 0.95),
        ("Date of Issue", "issued_date", 0.95),
    ],
    "bank_passbook": [
        ("Account Holder Name", "full_name", 0.97),
        ("Account Number", "account_number", 0.98),
        ("IFSC Code", "ifsc_code", 0.97),
        ("Bank Name", "bank_name", 0.96),
        ("Branch", "branch", 0.95),
    ],
    "ration_card": [
        ("Ration Card Number", "ration_card_number", 0.96),
        ("Head of Household", "household_head_name", 0.96),
        ("Category", "category", 0.96),
        ("Address", "address", 0.95),
    ],
    "income_self_declaration": [
        ("Applicant Name", "full_name", 0.96),
        ("Self-Declared Annual Family Income", "annual_family_income", 0.95),
        ("Declaration Date", "declaration_date", 0.96),
    ],
}


class MockLLMProvider(LLMProvider):
    def __init__(self, document_types_path: Path | str | None = None) -> None:
        with open(document_types_path or _DEFAULT_KNOWLEDGE, encoding="utf-8") as fh:
            self._document_types = json.load(fh)["document_types"]
        self._signals: list[tuple[str, list[str]]] = [
            (t["id"], [s.lower() for s in t.get("classification_signals", [])]) for t in self._document_types
        ]

    def name(self) -> str:
        return "mock"

    # --- workflow generation (templates replaced generation; kept for API parity) ---

    def generate_workflow(self, goal: str, knowledge: dict) -> dict:
        raw = knowledge["workflow"]
        workflow = {k: (list(v) if isinstance(v, list) else v) for k, v in raw.items()}
        workflow["goal"] = goal
        return workflow

    # --- document intelligence ---

    def classify_document(self, text: str) -> ClassificationResult:
        lowered = (text or "")[:4000].lower()
        best_cat = "other"
        best_hits = 0
        reasoning = "no matching catalog signals"
        for category, signals in self._signals:
            hits = sum(1 for s in signals if s in lowered)
            if hits > best_hits:
                best_cat, best_hits = category, hits
                reasoning = f"matched catalog signals {signals}"
        confidence = clamped(0.5 + 0.4 * min(1.0, best_hits))
        return ClassificationResult(
            classification=best_cat,
            confidence=confidence,
            reasoning=reasoning,
        )

    def extract_fields(self, text: str, classification: str) -> dict[str, ExtractedField]:
        specs = _EXTRACTORS.get(classification)
        if not specs:
            return {}
        fields: dict[str, ExtractedField] = {}
        for label, key, confidence in specs:
            pattern = re.compile(rf"^{re.escape(label)}:\s*(.+)$", re.MULTILINE)
            found = pattern.search(text)
            if found:
                fields[key] = ExtractedField(
                    value=found.group(1).strip(),
                    confidence=confidence,
                    source_text=found.group(0).strip(),
                )
        return fields

    # --- cross document validation (advisory-only) ---

    def run_cross_validation(
        self,
        requirements: dict[str, Any] | list[dict[str, Any]],
        extracted_fields: dict[str, dict[str, ExtractedField]],
    ) -> CrossValidationResult:
        """Advisory pass-through.

        The deterministic rules engine (app/rules/engine.py) owns the decision;
        in demo mode the mock has no additional signal to add, so it confirms the
        pass. A real provider should only ever *add warnings* here.
        """
        return CrossValidationResult(
            status=ValidationStatus.PASS,
            confidence=0.97,
            issues=[],
            suggestions=[],
            checked_documents=sorted(extracted_fields),
        )