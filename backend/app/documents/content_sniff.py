"""Magic-byte content sniffing for upload hardening.

Production (strict) mode verifies that an upload's bytes match its declared
content type before they reach storage. Demo mode stays lenient: the frontend
demo shortcut buttons upload plain-text bytes that only pretend to be PDFs, so
strict content checks are disabled when DEMO_MODE=true.
"""

from __future__ import annotations

_HEADER_SCAN_BYTES = 1024

_MAGIC: dict[str, bytes] = {
    "image/jpeg": b"\xff\xd8\xff",
    "image/png": b"\x89PNG\r\n\x1a\n",
    "application/pdf": b"%PDF-",
}


def sniff_mime(content: bytes) -> str | None:
    """Return the MIME type implied by the file's magic bytes, or None.

    Unknown (or empty) content returns None so strict callers can reject
    known-signature mismatches while letting unrecognized content through.
    """
    for mime, magic in _MAGIC.items():
        if content.startswith(magic):
            return mime
    # A valid PDF may carry a leading BOM or whitespace before the "%PDF-" header.
    if b"%PDF-" in content[: _HEADER_SCAN_BYTES]:
        return "application/pdf"
    return None


def validate_upload_content(
    *,
    mime: str,
    content: bytes,
    allowed_mime_types: list[str],
    strict: bool,
) -> str | None:
    """Return a user-facing error message for a content/type mismatch, or None.

    Only the signature/type check is gated on ``strict``: strict=False
    (DEMO_MODE=true) accepts any nonzero payload so the demo shortcut buttons
    (which upload plain-text bytes pretending to be PDFs) keep working. Empty
    files are rejected by the route with ``400`` in every mode; this helper
    never reports an empty payload as a mismatch.
    """
    if not strict:
        return None
    declared = mime.split(";")[0].strip().lower()
    detected = sniff_mime(content)
    if detected is not None and detected != declared and declared in set(allowed_mime_types):
        return "file content does not match its declared content type"
    return None
