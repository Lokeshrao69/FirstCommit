"""Sensitive-value masking.

Applied in the document pipeline *after* extraction and *before* persistence or
any API response. The LLM must never be asked to mask values; this is plain,
deterministic string surgery so a leak is impossible even if a provider behaves
oddly. Values record the last four digits only.
"""

from __future__ import annotations

import re
from typing import Any

from ..models.document import ExtractedField

_MIN_SENSITIVE_DIGITS = 9


def mask_number(value: Any) -> str:
    """Mask all but the last four digits of a long number, preserving formatting.

    Bound to numbers with >= `_MIN_SENSITIVE_DIGITS` digits so short figures
    (e.g. a percentage) are left alone.
    """
    text = str(value)
    digits = [ch for ch in text if ch.isdigit()]
    if len(digits) < _MIN_SENSITIVE_DIGITS:
        return text
    masked = "".join("X" * (len(digits) - 4) + "".join(digits[-4:]))
    out = []
    it = iter(masked)
    for ch in text:
        out.append(next(it) if ch.isdigit() else ch)
    return "".join(out)


def redact_digits(text: object, min_length: int = _MIN_SENSITIVE_DIGITS) -> str:
    """Replace long digit runs in source text with a masked placeholder."""
    value = str(text)

    def repl(m: re.Match[str]) -> str:
        return "•" * len(m.group(0))

    return re.sub(rf"\d{{{min_length},}}", repl, value)


def apply_field_masking(
    fields: dict[str, ExtractedField],
    sensitive: set[str] | list[str],
) -> dict[str, ExtractedField]:
    """Return a new field map with sensitive values and their source text masked.

    The caller persists the returned map; the original objects are untouched.
    """
    masked: dict[str, ExtractedField] = {}
    for key, field in fields.items():
        if key not in sensitive:
            masked[key] = field
            continue
        masked[key] = ExtractedField(
            value=mask_number(field.value),
            confidence=field.confidence,
            source_text=redact_digits(field.source_text) if field.source_text else None,
        )
    return masked
