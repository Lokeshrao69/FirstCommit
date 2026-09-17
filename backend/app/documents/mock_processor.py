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

from .processor import DocumentObjectStore, DocumentProcessor

TRANSCRIPT_HEADER = """Northbridge State University
Office of the Registrar — Official Academic Transcript (DEMO)

Name: Alex Rivera
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
}

GOVERNMENT_ID_TEXT = """STATE OF FICTION — DEMONSTRATION GOVERNMENT ID CARD

Name: Alex Rivera
Date of Birth: 1999-04-12
Government ID Number: FF-ID-8841-DEMO
Usable for demo purposes only.
"""

INCOME_CERTIFICATE_TEXT = """FICTION FINANCIAL SERVICES — INCOME CERTIFICATE (DEMO)

Recipient: Alex Rivera
Annual Income:
Valid Until: 2027-06-30
Estimated total annual income for scholarship assessment.
"""

ESSAY_TEXT = """Personal Statement (DEMO)

I am applying to the Merit Excellence Scholarship because I believe in the value of
rigorous study and community contribution. This is entirely fictional demo content
and contains no real personal information.
"""


class MockObjectStore(DocumentObjectStore):
    def __init__(self) -> None:
        self._blobs: dict[str, bytes] = {}

    def put(self, key: str, content: bytes, mime_type: str) -> str:
        self._blobs[key] = content
        return f"mock://{key}"

    def delete(self, key: str) -> None:
        self._blobs.pop(key, None)


class MockDocumentProcessor(DocumentProcessor):
    def extract_text(self, content: bytes, filename: str, mime_type: str) -> str:
        lowered = filename.lower()
        content_sig = hashlib.sha256(content or b"").hexdigest()[:8]
        if "transcript" in lowered:
            variant = "valid" if _is_corrected(filename) else "conflict"
            vals = TRANSCRIPT_VALUES[variant]
            return "".join(
                [
                    TRANSCRIPT_HEADER,
                    f"Cumulative GPA: {vals['cumulative']}\n",
                    f"Semester GPA: {vals['semester']}\n",
                    f"Expected Graduation: {vals['graduation']}\n",
                    f"Credits Completed: {vals['credits']}\n",
                    f"Record ID: TR-{content_sig}-DEMO\n",
                ]
            )
        if "identity" in lowered or "government" in lowered or "passport" in lowered or "id" in lowered:
            return GOVERNMENT_ID_TEXT
        if "income" in lowered or "salary" in lowered or "payslip" in lowered:
            return INCOME_CERTIFICATE_TEXT
        if "essay" in lowered or "statement" in lowered:
            return ESSAY_TEXT
        return f"Demo processor received '{filename}' (demo content).\n"


def _is_corrected(filename: str) -> bool:
    lowered = filename.lower()
    return bool(re.search(r"(corrected|valid|fixed)", lowered))
