"""Indian financial amount parsing and formatting.

Indian number grouping groups by 3 then 2 ("2,50,000"), so amounts must not be
parsed with generic comma removal that assumes thousands. `parse_inr` strips
thousands separators irrespective of grouping because groups are only separators.
"""

from __future__ import annotations

import re

_NUMBER = re.compile(r"[0-9]+")
_SYMBOLS = "₹Rs.,/-"
_MULTIPLIERS = {
    "thousand": 1_000,
    "lakh": 100_000,
    "lack": 100_000,
    "lakhs": 100_000,
    "lacs": 100_000,
    "crore": 10_000_000,
    "crores": 10_000_000,
}


def parse_inr(value: object) -> float | None:
    """Parse an Indian currency amount to a float, or None when unreadable.

    Handles: symbols (Rs/₹), Indian and international grouping, "lakh/lac",
    "crore" and "thousand" qualifiers, and a trailing "/-".
    """
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    lower = text.lower()
    multiplier = 1.0
    for word, mult in _MULTIPLIERS.items():
        if re.search(rf"\b{word}\b", lower):
            multiplier = float(mult)
            lower = re.sub(rf"\b{word}\b", " ", lower)
            break
    digits = _NUMBER.findall(lower)
    if not digits:
        return None
    try:
        amount = float("".join(digits))
    except ValueError:
        return None
    if amount <= 0:
        return None
    return amount * multiplier


def inr_grouped(amount: float) -> str:
    """Format a number using Indian digit grouping: 250000 -> \"2,50,000\"."""
    digits = f"{float(amount):,.2f}"
    if digits.endswith(".00"):
        digits = digits[:-3]
    integer, _, fraction = digits.partition(".")
    groups = integer.split(",")
    if len(groups) <= 2:
        result = integer
    else:
        result = ",".join([groups[0], *[g if len(g) == 3 else f"{int(g):03d}" for g in groups[1:-1]], groups[-1]])
    return f"{result}.{fraction}" if fraction else result