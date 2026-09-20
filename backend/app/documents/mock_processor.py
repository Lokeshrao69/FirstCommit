"""Deterministic demo processors.

- MockObjectStore: in-memory byte storage (stands in for S3 in DEMO_MODE).
- MockDocumentProcessor: generates fictional, deterministic document text from the
  uploaded filename so the demo never depends on real file parsing.

The demo corpus mirrors the knowledge catalog (`knowledge/document_types.json`):
Aadhaar, income certificate, marks memo, bonafide certificate, bank passbook,
ration card and income self-declaration. Values are fictional; no real personal
data is used. `DEMO_TEXTS` is the single source of truth shared by the processor
and the evaluation fixture generator.
"""

from __future__ import annotations

import hashlib
import re
from collections import OrderedDict

from .processor import DocumentObjectStore, DocumentProcessor

DEFAULT_MAX_BYTES = 50 * 1024 * 1024
DEFAULT_MAX_OBJECTS = 500

# --------------------------------------------------------------------------
# Demo corpus (single source of truth)
# --------------------------------------------------------------------------

AADHAAR_STUDENT = """UNIQUE IDENTIFICATION AUTHORITY OF INDIA — AADHAAR (DEMO)

Aadhaar Number: 2345 6789 0123
Name: S. Priya
Father's Name: S. Venkatesh
Date of Birth: 18-06-2005
Gender: Female
Address: 12, Gandhi Street, Fictional Town

This is a fictional demonstration Aadhaar. No real personal data is used.
"""

AADHAAR_ELDERLY = """UNIQUE IDENTIFICATION AUTHORITY OF INDIA — AADHAAR (DEMO)

Aadhaar Number: 4567 8901 2345
Name: K. Subba Rao
Date of Birth: 15-04-1958
Gender: Male
Address: 4, Temple Street, Fictional Town

This is a fictional demonstration Aadhaar. No real personal data is used.
"""

AADHAAR_TOO_YOUNG = """UNIQUE IDENTIFICATION AUTHORITY OF INDIA — AADHAAR (DEMO)

Aadhaar Number: 5678 9012 3456
Name: K. Subba Rao
Date of Birth: 15-04-1998
Gender: Male
Address: 4, Temple Street, Fictional Town

This is a fictional demonstration Aadhaar. No real personal data is used.
"""

AADHAAR_MISMATCH = """UNIQUE IDENTIFICATION AUTHORITY OF INDIA — AADHAAR (DEMO)

Aadhaar Number: 6789 0123 4567
Name: Sita Raju
Father's Name: R. Kannaiah
Date of Birth: 12-09-2004
Gender: Female
Address: 88, Market Road, Fictional Town

This is a fictional demonstration Aadhaar. No real personal data is used.
"""

INCOME_CERTIFICATE_VALID = """REVENUE DEPARTMENT — INCOME CERTIFICATE (DEMO)

Certificate No: IC-2026-00421
Name: S. Priya
Father's Name: S. Venkatesh
Address: 12, Gandhi Street, Fictional Town
Annual Family Income: Rs. 1,80,000
Income Reference Period: Financial Year 2025-26
Date of Issue: 02-06-2026
Valid Until: 31-03-2027

Issued by the Mandal Revenue Officer for scholarship assessment (illustrative demo certificate).
"""

INCOME_CERTIFICATE_EXPIRED = """REVENUE DEPARTMENT — INCOME CERTIFICATE (DEMO)

Certificate No: IC-2024-00901
Name: S. Priya
Father's Name: S. Venkatesh
Address: 12, Gandhi Street, Fictional Town
Annual Family Income: Rs. 1,80,000
Income Reference Period: Financial Year 2024-25
Date of Issue: 02-06-2025
Valid Until: 31-12-2025

Issued by the Mandal Revenue Officer for scholarship assessment (illustrative demo certificate).
"""

INCOME_CERTIFICATE_OVER_LIMIT = """REVENUE DEPARTMENT — INCOME CERTIFICATE (DEMO)

Certificate No: IC-2026-00888
Name: S. Priya
Father's Name: S. Venkatesh
Address: 12, Gandhi Street, Fictional Town
Annual Family Income: Rs. 3,20,000
Income Reference Period: Financial Year 2025-26
Date of Issue: 02-06-2026
Valid Until: 31-03-2027

Issued by the Mandal Revenue Officer for scholarship assessment (illustrative demo certificate).
"""

INCOME_CERTIFICATE_NAME_MISMATCH = """REVENUE DEPARTMENT — INCOME CERTIFICATE (DEMO)

Certificate No: IC-2026-00666
Name: Sita Raju
Father's Name: R. Kannaiah
Address: 88, Market Road, Fictional Town
Annual Family Income: Rs. 1,50,000
Income Reference Period: Financial Year 2025-26
Date of Issue: 02-06-2026
Valid Until: 31-03-2027

Issued by the Mandal Revenue Officer for scholarship assessment (illustrative demo certificate).
"""

MARKS_MEMO = """UNIVERSITY OF FICTION — MARKS MEMO / GRADE SHEET (DEMO)

Name: S. Priya
Father's Name: S. Venkatesh
Enrollment No: EN-2023-0042
Board / University: University of Fiction
Institution: University of Fiction
Examination: B.Sc. Computer Science — VI Semester
Year of Passing: 2026
Percentage / CGPA: 82% (CGPA 8.4)
Result: Pass

This is a fictional demonstration marks memo. No real personal data is used.
"""

MARKS_MEMO_NO_PERCENTAGE = """UNIVERSITY OF FICTION — MARKS MEMO / GRADE SHEET (DEMO)

Name: S. Priya
Father's Name: S. Venkatesh
Enrollment No: EN-2023-0042
Board / University: University of Fiction
Institution: University of Fiction
Examination: B.Sc. Computer Science — VI Semester
Year of Passing: 2026
Result: Pass

This is a fictional demonstration marks memo. No real personal data is used.
"""

BONAFIDE = """UNIVERSITY OF FICTION — BONAFIDE CERTIFICATE (DEMO)

Name: S. Priya
Father's Name: S. Venkatesh
Institution: University of Fiction
Course: B.Sc. Computer Science
Year of Study: 3rd Year
Admission / Roll No: EN-2023-0042
Date of Issue: 10-07-2026

This certifies that the above student is currently enrolled in the 2023-2026 batch (fictional demo certificate).
"""

BANK_PASSBOOK = """NATIONAL FICTION BANK — SAVINGS BANK PASSBOOK (DEMO)

Bank Name: National Fiction Bank
Account Holder Name: K. Subba Rao
Account Number: 1042568877914560
IFSC Code: FICB0001234
Branch: Fictional Town

Fictional demonstration passbook page. No real account data is used.
"""

BANK_PASSBOOK_STUDENT = """NATIONAL FICTION BANK — SAVINGS BANK PASSBOOK (DEMO)

Bank Name: National Fiction Bank
Account Holder Name: S. Priya
Account Number: 9988776655443322
IFSC Code: FICB0001234
Branch: Fictional Town

Fictional demonstration passbook page. No real account data is used.
"""

RATION_CARD_BPL = """PUBLIC DISTRIBUTION SYSTEM — RATION CARD (DEMO)

Ration Card Number: RC-2021-00312
Head of Household: K. Subba Rao
Category: BPL
Address: 4, Temple Street, Fictional Town
Member Names: K. Subba Rao, K. Lakshmi

Fictional demonstration ration card. No real personal data is used.
"""

RATION_CARD_APL = """PUBLIC DISTRIBUTION SYSTEM — RATION CARD (DEMO)

Ration Card Number: RC-2021-00444
Head of Household: K. Subba Rao
Category: APL
Address: 4, Temple Street, Fictional Town
Member Names: K. Subba Rao, K. Lakshmi

Fictional demonstration ration card. No real personal data is used.
"""

SELF_DECLARATION = """INCOME SELF-DECLARATION (DEMO)

I, S. Priya, daughter of S. Venkatesh, residing at 12, Gandhi Street, Fictional Town,
hereby declare that the annual family income of my household is as stated below.

Applicant Name: S. Priya
Self-Declared Annual Family Income: Rs. 1,80,000
Declaration Date: 15-08-2026
Signature: (attached digitally)

This is a fictional demonstration declaration for applying for an income certificate.
"""

SELF_DECLARATION_STALE = """INCOME SELF-DECLARATION (DEMO)

I, S. Priya, daughter of S. Venkatesh, residing at 12, Gandhi Street, Fictional Town,
hereby declare that the annual family income of my household is as stated below.

Applicant Name: S. Priya
Self-Declared Annual Family Income: Rs. 1,80,000
Declaration Date: 15-03-2026
Signature: (attached digitally)

This is a fictional demonstration declaration for applying for an income certificate.
"""

SELF_DECLARATION_OVER_LIMIT = """INCOME SELF-DECLARATION (DEMO)

I, S. Priya, daughter of S. Venkatesh, residing at 12, Gandhi Street, Fictional Town,
hereby declare that the annual family income of my household is as stated below.

Applicant Name: S. Priya
Self-Declared Annual Family Income: Rs. 3,20,000
Declaration Date: 15-08-2026
Signature: (attached digitally)

This is a fictional demonstration declaration for applying for an income certificate.
"""

# filename -> canned text. Variants are chosen by filename keywords so a single
# `extract_text` call can keep the whole pipeline deterministic.
DEMO_TEXTS: dict[str, str] = {
    "aadhaar.pdf": AADHAAR_STUDENT,
    "aadhaar_elderly.pdf": AADHAAR_ELDERLY,
    "aadhaar_too_young.pdf": AADHAAR_TOO_YOUNG,
    "aadhaar_name_mismatch.pdf": AADHAAR_MISMATCH,
    "income_certificate_valid.pdf": INCOME_CERTIFICATE_VALID,
    "income_certificate_expired.pdf": INCOME_CERTIFICATE_EXPIRED,
    "income_certificate_over_limit.pdf": INCOME_CERTIFICATE_OVER_LIMIT,
    "income_certificate_name_mismatch.pdf": INCOME_CERTIFICATE_NAME_MISMATCH,
    "marks_memo.pdf": MARKS_MEMO,
    "marks_memo_no_percentage.pdf": MARKS_MEMO_NO_PERCENTAGE,
    "bonafide_certificate.pdf": BONAFIDE,
    "bank_passbook.pdf": BANK_PASSBOOK,
    "bank_passbook_student.pdf": BANK_PASSBOOK_STUDENT,
    "ration_card.pdf": RATION_CARD_BPL,
    "ration_card_apl.pdf": RATION_CARD_APL,
    "income_self_declaration.pdf": SELF_DECLARATION,
    "income_self_declaration_stale.pdf": SELF_DECLARATION_STALE,
    "income_self_declaration_over_limit.pdf": SELF_DECLARATION_OVER_LIMIT,
}

# Legacy demo filenames (kept so old uploads/fixtures still behave):
_LEGACY_ALIASES: dict[str, str] = {
    "transcript_corrected.pdf": "marks_memo.pdf",
    "transcript_valid.pdf": "marks_memo.pdf",
    "transcript_gpa_conflict.pdf": "marks_memo.pdf",
    "transcript_missing_name.pdf": "marks_memo_no_percentage.pdf",
    "government_id_valid.pdf": "aadhaar.pdf",
    "government_id_name_mismatch.pdf": "aadhaar_name_mismatch.pdf",
    "enrollment_verification.pdf": "bonafide_certificate.pdf",
    "personal_essay.pdf": "income_self_declaration.pdf",
    "essay.pdf": "income_self_declaration.pdf",
    "income_certificate.pdf": "income_certificate_valid.pdf",
}


def demo_text_for(filename: str) -> str:
    """Canned demo text for a filename (with legacy aliases), else a fallback."""
    lowered = filename.lower()
    if lowered in DEMO_TEXTS:
        return DEMO_TEXTS[lowered]
    if lowered in _LEGACY_ALIASES:
        return DEMO_TEXTS[_LEGACY_ALIASES[lowered]]
    return 'no demo text'


class MockObjectStore(DocumentObjectStore):
    """In-memory object store bounded by byte count and object count (4D).

    Mirrors S3's object lifecycle for the demo: when the byte budget or the
    object budget is exceeded the oldest object is evicted first. Defaults pass
    any realistic demo workflow (50 MB / 500 objects).
    """

    def __init__(
        self,
        max_bytes: int = DEFAULT_MAX_BYTES,
        max_objects: int = DEFAULT_MAX_OBJECTS,
    ) -> None:
        if max_bytes <= 0 or max_objects <= 0:
            raise ValueError("max_bytes and max_objects must be positive")
        self._max_bytes = max_bytes
        self._max_objects = max_objects
        self._blobs: OrderedDict[str, bytes] = OrderedDict()
        self._total_bytes = 0

    def put(self, key: str, content: bytes, mime_type: str) -> str:
        if key in self._blobs:
            self._total_bytes -= len(self._blobs.pop(key))
        self._blobs[key] = content
        self._total_bytes += len(content)
        self._evict_oldest()
        return f"mock://{key}"

    def delete(self, key: str) -> None:
        if key in self._blobs:
            self._total_bytes -= len(self._blobs.pop(key))

    def _evict_oldest(self) -> None:
        while self._blobs and (
            len(self._blobs) > self._max_objects or self._total_bytes > self._max_bytes
        ):
            oldest_key, oldest = self._blobs.popitem(last=False)
            self._total_bytes -= len(oldest)


class MockDocumentProcessor(DocumentProcessor):
    def extract_text(
        self, content: bytes, filename: str, mime_type: str, storage_uri: str | None = None
    ) -> str:
        lowered = filename.lower()
        content_sig = hashlib.sha256(content or b"").hexdigest()[:8]
        if lowered in DEMO_TEXTS or lowered in _LEGACY_ALIASES:
            text = demo_text_for(lowered)
            return f"{text}\nRecord ID: MO-{content_sig}-DEMO\n"
        if "transcript" in lowered:
            variant = _transcript_variant(lowered)
            demo = "marks_memo.pdf" if variant != "missing_name" else "marks_memo_no_percentage.pdf"
            return f"{demo_text_for(demo)}\nRecord ID: MO-{content_sig}-DEMO\n"
        return f"Demo processor received '{filename}' (demo content). Record ID: MO-{content_sig}-DEMO\n"


def _transcript_variant(filename: str) -> str:
    lowered = filename.lower()
    if re.search(r"(missing_name|no_name)", lowered):
        return "missing_name"
    return "valid"