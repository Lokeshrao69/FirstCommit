"""Date and age helpers for document validation."""

from __future__ import annotations

from datetime import date, datetime

_FORMATS = (
    "%d-%m-%Y",
    "%d/%m/%Y",
    "%d.%m.%Y",
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%d %B %Y",
    "%B %d, %Y",
    "%b %d, %Y",
    "%d %b %Y",
)


def parse_date(value: object) -> date | None:
    """Parse a date from a common Indian format. Returns None when unreadable."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if "T" in text:
        text = text.split("T", 1)[0]
    for fmt in _FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def age_from(dob: object, today: date | None = None) -> int | None:
    """Whole years since a date of birth, or None when the DOB is unreadable."""
    parsed = parse_date(dob)
    if parsed is None:
        return None
    base = today or date.today()
    years = base.year - parsed.year
    if (base.month, base.day) < (parsed.month, parsed.day):
        years -= 1
    return years


def days_between(start: object, end: object) -> int | None:
    s, e = parse_date(start), parse_date(end)
    if s is None or e is None:
        return None
    return (e - s).days


def is_expired(valid_until: object, today: date | None = None) -> bool | None:
    """True when the certificate is valid only in the past. None if unreadable."""
    parsed = parse_date(valid_until)
    if parsed is None:
        return None
    return parsed < (today or date.today())
