"""Deterministic eligibility verification.

This is intentional: eligibility is a deterministic rule evaluation against the
applicant profile, not an LLM call. Intelligence + determinism are kept separate.
"""

from __future__ import annotations

from typing import Any


def check_eligibility(profile: dict[str, Any], requirements: dict[str, Any]) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    passed = True

    def cmp(field: str) -> bool:
        rule = requirements.get(field)
        if not rule or field not in profile:
            return True
        try:
            actual = float(profile[field])
            wanted = float(rule["value"])
        except (TypeError, ValueError):
            return True
        return actual >= wanted if rule["operator"] == "gte" else True

    if not cmp("cumulative_gpa"):
        passed = False
        reasons.append(
            f"Cumulative GPA {profile.get('cumulative_gpa')} is below the required "
            f"{requirements['cumulative_gpa']['value']}."
        )
    if not cmp("current_semester_gpa"):
        passed = False
        reasons.append(
            f"Current semester GPA {profile.get('current_semester_gpa')} is below the required "
            f"{requirements['current_semester_gpa']['value']}."
        )
    if not cmp("expected_graduation"):
        passed = False
        reasons.append(
            f"Expected graduation {profile.get('expected_graduation')} is before the required "
            f"{requirements['expected_graduation']['value']}."
        )

    enroll = requirements.get("enrollment_status")
    if enroll and "enrollment_status" in profile:
        if str(profile["enrollment_status"]).lower() != str(enroll["value"]).lower():
            passed = False
            reasons.append(
                f"Enrollment is '{profile['enrollment_status']}', expected '{enroll['value']}'."
            )

    if passed:
        reasons.append("All eligibility requirements are satisfied.")
    return passed, reasons
