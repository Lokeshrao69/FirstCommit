"""Deterministic mock LLM provider for DEMO_MODE and tests.

Implements the same contracts as the Bedrock provider so the demo is fully
functional offline. No model calls happen here. Also used as the documented
fallback if Bedrock fails during a live demo.
"""

from __future__ import annotations

import re
from typing import Any

from ..core.confidence import clamped
from ..models.document import (
    ClassificationResult,
    CrossValidationResult,
    ExtractedField,
    ValidationIssue,
    ValidationSeverity,
    ValidationStatus,
)
from .llm_provider import LLMProvider

DOCUMENT_CATEGORIES = [
    "academic_transcript",
    "government_id",
    "proof_of_income",
    "recommendation_letter",
    "personal_essay",
    "enrollment_verification",
    "other",
]

_FILENAME_HINTS = {
    "academic_transcript": ["transcript"],
    "proof_of_income": ["income", "salary", "payslip"],
    "government_id": ["government", "passport", "identity", "id card", "id_card"],
    "recommendation_letter": ["recommendation", "reference"],
    "personal_essay": ["essay", "statement"],
    "enrollment_verification": ["enrollment"],
}


class MockLLMProvider(LLMProvider):
    def name(self) -> str:
        return "mock"

    # --- workflow generation ---

    def generate_workflow(self, goal: str, knowledge: dict) -> dict:
        raw = knowledge["workflow"]
        workflow = {
            k: (list(v) if isinstance(v, list) else v)
            for k, v in raw.items()
        }
        workflow["goal"] = goal
        return workflow

    # --- document intelligence ---

    def classify_document(self, text: str) -> ClassificationResult:
        lowered = text[:4000].lower()
        best_cat = "other"
        best_hits = 0
        reasoning = "no matching category hints"
        for category, hints in _FILENAME_HINTS.items():
            hits = sum(1 for h in hints if h in lowered)
            if hits > best_hits:
                best_cat, best_hits = category, hits
                reasoning = f"matched filename hints {hints}"
        confidence = clamped(0.5 + 0.5 * min(1.0, best_hits / 2))
        return ClassificationResult(
            classification=best_cat,
            confidence=confidence,
            reasoning=reasoning,
        )

    def extract_fields(self, text: str, classification: str) -> dict[str, ExtractedField]:
        if classification == "academic_transcript":
            return self._extract_transcript(text)
        if classification == "government_id":
            return self._extract_identity(text)
        if classification == "proof_of_income":
            return self._extract_income(text)
        if classification == "personal_essay":
            return {"submitted": ExtractedField(value=True, confidence=0.99, source_text="personal essay submitted")}
        if classification == "enrollment_verification":
            return self._extract_enrollment(text)
        return {
            "document_type": ExtractedField(value=classification, confidence=0.5, source_text=None)
        }

    @staticmethod
    def _grab(pattern: re.Pattern[str], text: str, label: str, confidence: float) -> ExtractedField | None:
        m = pattern.search(text)
        if not m:
            return None
        return ExtractedField(value=m.group(1).strip(), confidence=confidence, source_text=m.group(0).strip())

    def _extract_transcript(self, text: str) -> dict[str, ExtractedField]:
        fields: dict[str, ExtractedField] = {}
        for pattern, key, confidence in [
            (re.compile(r"Name:\s*(.+)$", re.M), "student_name", 0.97),
            (re.compile(r"University:\s*(.+)$", re.M), "university_name", 0.96),
            (re.compile(r"Cumulative GPA:\s*(\d\.\d+)", re.M), "cumulative_gpa", 0.96),
            (re.compile(r"Semester GPA:\s*(\d\.\d+)", re.M), "current_semester_gpa", 0.9),
            (re.compile(r"Status:\s*(full[\s-]?time|part[\s-]?time)", re.I), "enrollment_status", 0.95),
            (re.compile(r"Expected Graduation:\s*(\d{4})", re.M), "expected_graduation", 0.93),
            (re.compile(r"Major:\s*(.+)$", re.M), "major", 0.9),
            (re.compile(r"Credits Completed:\s*(\d+)", re.M), "credits_completed", 0.9),
        ]:
            f = self._grab(pattern, text, key, confidence)
            if f is not None:
                fields[key] = f
        return fields

    def _extract_identity(self, text: str) -> dict[str, ExtractedField]:
        fields: dict[str, ExtractedField] = {}
        for pattern, key, label in [
            (re.compile(r"Name:\s*(.+)$", re.M), "full_name", "full name"),
            (re.compile(r"Date of Birth:\s*(.+)$", re.M), "date_of_birth", "date of birth"),
            (re.compile(r"ID Number:\s*(.+)$", re.M), "id_number", "ID number"),
        ]:
            f = self._grab(pattern, text, label, 0.95)
            if f is not None:
                fields[key] = f
        return fields

    def _extract_income(self, text: str) -> dict[str, ExtractedField]:
        fields: dict[str, ExtractedField] = {}
        for pattern, key, label in [
            (re.compile(r"Annual Income:\s*(.+)$", re.M), "annual_income", "annual income"),
            (re.compile(r"Valid Until:\s*(.+)$", re.M), "valid_until", "validity"),
        ]:
            f = self._grab(pattern, text, label, 0.92)
            if f is not None:
                fields[key] = f
        return fields

    def _extract_enrollment(self, text: str) -> dict[str, ExtractedField]:
        fields: dict[str, ExtractedField] = {}
        for pattern, key, label in [
            (
                re.compile(r"Enrollment:\s*(full[\s-]?time|part[\s-]?time)", re.I),
                "enrollment_status",
                "enrollment status",
            ),
            (
                re.compile(r"Expected Graduation:\s*(\d{4})", re.M),
                "expected_graduation",
                "expected graduation",
            ),
        ]:
            f = self._grab(pattern, text, label, 0.94)
            if f is not None:
                fields[key] = f
        return fields

    # --- cross document validation ---

    def run_cross_validation(
        self,
        requirements: dict[str, Any],
        extracted_fields: dict[str, dict[str, ExtractedField]],
    ) -> CrossValidationResult:
        issues: list[ValidationIssue] = []
        checks = 0

        transcript = extracted_fields.get("academic_transcript", {})
        identity = extracted_fields.get("government_id", {})

        def req(name: str) -> dict[str, Any] | None:
            return requirements.get(name)

        if req("cumulative_gpa") and "cumulative_gpa" in transcript:
            checks += 1
            if not _meets_requirement(transcript["cumulative_gpa"], req("cumulative_gpa")):
                issues.append(
                    ValidationIssue(
                        severity=ValidationSeverity.ERROR,
                        field="cumulative_gpa",
                        message=(
                    f"Cumulative GPA {transcript['cumulative_gpa'].value} is below the required "
                    f"{req('cumulative_gpa')['value']}."
                ),
                        evidence=[transcript["cumulative_gpa"].source_text or ""],
                    )
                )

        if req("current_semester_gpa") and "current_semester_gpa" in transcript:
            checks += 1
            if not _meets_requirement(transcript["current_semester_gpa"], req("current_semester_gpa")):
                issues.append(
                    ValidationIssue(
                        severity=ValidationSeverity.WARNING,
                        field="current_semester_gpa",
                        message=(
                            f"Current semester GPA {transcript['current_semester_gpa'].value} "
                            f"does not meet the requirement of {req('current_semester_gpa')['value']}."
                        ),
                        evidence=[transcript["current_semester_gpa"].source_text or ""],
                        suggestion="Upload a corrected transcript or acknowledge this warning to continue.",
                    )
                )

        if req("enrollment_status") and "enrollment_status" in transcript:
            checks += 1
            if not _same_enrollment(transcript["enrollment_status"], req("enrollment_status")):
                issues.append(
                    ValidationIssue(
                        severity=ValidationSeverity.ERROR,
                        field="enrollment_status",
                        message=(
                    f"Enrollment is {transcript['enrollment_status'].value}, "
                    f"expected {req('enrollment_status')['value']}."
                ),
                        evidence=[transcript["enrollment_status"].source_text or ""],
                    )
                )

        if req("expected_graduation") and "expected_graduation" in transcript:
            checks += 1
            try:
                actual = int(str(transcript["expected_graduation"].value))
            except ValueError:
                actual = None
            if actual is not None and actual < int(req("expected_graduation")["value"]):
                issues.append(
                    ValidationIssue(
                        severity=ValidationSeverity.ERROR,
                        field="expected_graduation",
                        message=(
                        f"Expected graduation {actual} does not meet the "
                        f"{req('expected_graduation')['value']} requirement."
                    ),
                        evidence=[transcript["expected_graduation"].source_text or ""],
                    )
                )

        if identity and "full_name" in identity and transcript and "student_name" in transcript:
            checks += 1
            if identity["full_name"].value.lower() != str(transcript["student_name"].value).lower():
                issues.append(
                    ValidationIssue(
                        severity=ValidationSeverity.WARNING,
                        field="full_name",
                        message="The name on the government ID does not match the transcript.",
                        evidence=[
                            identity["full_name"].source_text or "",
                            transcript["student_name"].source_text or "",
                        ],
                        suggestion="Upload a government ID that matches the applicant's name.",
                    )
                )

        if issues:
            status = (
                ValidationStatus.BLOCK
                if any(i.severity == ValidationSeverity.ERROR for i in issues)
                else ValidationStatus.NEEDS_REVIEW
            )
            confidence = clamped(0.9 - 0.08 * len(issues))
        else:
            status = ValidationStatus.PASS
            confidence = clamped(0.85 + 0.02 * checks)

        return CrossValidationResult(
            status=status,
            confidence=confidence,
            issues=issues,
            suggestions=[i.suggestion for i in issues if i.suggestion],
            checked_documents=sorted(extracted_fields),
        )


def _meets_requirement(field: ExtractedField, rule: dict[str, Any]) -> bool:
    """True when the extracted field satisfies the rule (numeric gte supported)."""
    try:
        actual = float(str(field.value))
    except ValueError:
        return False
    return actual >= float(rule["value"])


def _same_enrollment(field: ExtractedField, rule: dict[str, Any]) -> bool:
    """Compare enrollment labels ignoring dashes/underscores/spaces."""
    a = "".join(ch for ch in str(field.value).lower() if ch.isalnum())
    b = "".join(ch for ch in str(rule["value"]).lower() if ch.isalnum())
    return a == b
