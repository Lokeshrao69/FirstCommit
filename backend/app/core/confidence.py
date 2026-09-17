"""Confidence gating.

Every AI output exposes confidence. The gates below are the single source of truth
for pass/warn/block semantics across the application.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..models.enums import CONFIDENCE_PASS, CONFIDENCE_WARN


@dataclass(frozen=True)
class ConfidenceDecision:
    label: str  # pass | warn | block
    auto_approved: bool
    requires_review: bool


def decide(
    confidence: float,
    pass_threshold: float = CONFIDENCE_PASS,
    warn_threshold: float = CONFIDENCE_WARN,
) -> ConfidenceDecision:
    if confidence >= pass_threshold:
        return ConfidenceDecision("pass", auto_approved=True, requires_review=False)
    if confidence >= warn_threshold:
        return ConfidenceDecision("warn", auto_approved=False, requires_review=True)
    return ConfidenceDecision("block", auto_approved=False, requires_review=True)


def clamped(confidence: float) -> float:
    return max(0.0, min(1.0, confidence))
