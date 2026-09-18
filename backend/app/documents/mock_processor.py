"""Deterministic demo processors.

- MockObjectStore: in-memory byte storage (stands in for S3 in DEMO_MODE).
- MockDocumentProcessor: generates fictional, deterministic document text from the
  uploaded filename so the demo never depends on real file parsing.

The filename keywords mirror the demo buttons in the frontend. Values are fictional;
no real personal data is used.
"""

from __future__ import annotations

import hashlib
import re
from collections import OrderedDict

from .processor import DocumentObjectStore, DocumentProcessor

DEFAULT_MAX_BYTES = 50 * 1024 * 1024
DEFAULT_MAX_OBJECTS = 500

TRANSCRIPT_HEADER = """Northbridge State University
Office of the Registrar — Official Academic Transcript (DEMO)

Name: Alex Rivera
University: Northbridge State University
Major: Computer Science
Status: Full-time
"""

TRANSCRIPT_HEADER_NO_NAME = """Northbridge State University
Office of the Registrar — Official Academic Transcript (DEMO)

University: Northbridge State University
Major: Computer Science
Status: Full-time
"""

TRANSCRIPT_VALUES = {
    "valid": {
        "cumulative": "3.72",
        "semester": "3.70",
        "graduation": "2027",
        "credits": "96",
    },
    "conflict": {
        "cumulative": "3.72",
        "semester": "3.20",
        "graduation": "2027",
        "credits": "96",
    },
    "missing_name": {
        "cumulative": "3.80",
        "semester": "3.75",
        "graduation": "2027",
        "credits": "96",
    },
}

GOVERNMENT_ID_TEXT = """STATE OF FICTION — DEMONSTRATION GOVERNMENT ID CARD

Name: Alex Rivera
Date of Birth: 1999-04-12
Government ID Number: FF-ID-8841-DEMO
Usable for demo purposes only.
"""

GOVERNMENT_ID_MISMATCH_TEXT = """STATE OF FICTION — DEMONSTRATION GOVERNMENT ID CARD

Name: Jordan Blake
Date of Birth: 1998-11-03
Government ID Number: FF-ID-5520-DEMO
Usable for demo purposes only.
"""

INCOME_CERTIFICATE_TEXT = """FICTION FINANCIAL SERVICES — INCOME CERTIFICATE (DEMO)

Recipient: Alex Rivera
Annual Income: 24000
Valid Until: 2027-06-30
Estimated total annual income for scholarship assessment.
"""

INCOME_CERTIFICATE_EXPIRED_TEXT = """FICTION FINANCIAL SERVICES — INCOME CERTIFICATE (DEMO)

Recipient: Alex Rivera
Annual Income: 24000
Valid Until: 2025-01-31
This certificate has expired and must be reissued before assessment.
"""

ENROLLMENT_VERIFICATION_TEXT = """Northbridge State University
Office of the Registrar — Enrollment Verification (DEMO)

Name: Alex Rivera
Enrollment: Full-time
Expected Graduation: 2027
"""

ESSAY_TEXT = """Personal Statement (DEMO)

I am applying to the Merit Excellence Scholarship because I believe in the value of
rigorous study and community contribution. This is entirely fictional demo content
and contains no real personal information.
"""


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
    def extract_text(self, content: bytes, filename: str, mime_type: str) -> str:
        lowered = filename.lower()
        content_sig = hashlib.sha256(content or b"").hexdigest()[:8]
        if "transcript" in lowered:
            variant = _transcript_variant(filename)
            vals = TRANSCRIPT_VALUES[variant]
            header = TRANSCRIPT_HEADER_NO_NAME if variant == "missing_name" else TRANSCRIPT_HEADER
            return "".join(
                [
                    header,
                    f"Cumulative GPA: {vals['cumulative']}\n",
                    f"Semester GPA: {vals['semester']}\n",
                    f"Expected Graduation: {vals['graduation']}\n",
                    f"Credits Completed: {vals['credits']}\n",
                    f"Record ID: TR-{content_sig}-DEMO\n",
                ]
            )
        if "enrollment" in lowered:
            return ENROLLMENT_VERIFICATION_TEXT
        if _identity_hint(lowered):
            if "mismatch" in lowered:
                return GOVERNMENT_ID_MISMATCH_TEXT
            return GOVERNMENT_ID_TEXT
        if "income" in lowered or "salary" in lowered or "payslip" in lowered:
            if "expired" in lowered:
                return INCOME_CERTIFICATE_EXPIRED_TEXT
            return INCOME_CERTIFICATE_TEXT
        if "essay" in lowered or "statement" in lowered:
            return ESSAY_TEXT
        return f"Demo processor received '{filename}' (demo content).\n"


def _transcript_variant(filename: str) -> str:
    lowered = filename.lower()
    if re.search(r"(corrected|valid|fixed)", lowered):
        return "valid"
    if "missing_name" in lowered or "no_name" in lowered:
        return "missing_name"
    return "conflict"


_IDENTITY_TOKENS = {"id", "identity", "government", "passport"}


def _identity_hint(lowered_filename: str) -> bool:
    """Token-based ID detection so names like 'valid' or 'paid' are not false hits."""
    tokens = re.split(r"[^a-z0-9]+", lowered_filename)
    return any(token in _IDENTITY_TOKENS for token in tokens)
