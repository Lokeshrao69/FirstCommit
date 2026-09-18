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
    """Return a user-facing error message for a bad upload, or None if it's fine.

    strict=False (DEMO_MODE=true) always accepts, keeping the demo shortcut
    buttons working. strict=True rejects empty files and uploaded bytes whose
    magic signature contradicts a declared allowed type; unrecognized nonempty
    content is accepted to avoid false negatives.
    """
    declared = mime.split(";")[0].strip().lower()
    if strict:
        if not content:
            return "empty file"
        detected = sniff_mime(content)
        if detected is not None and detected != declared and declared in set(allowed_mime_types):
            return "file content does not match its declared content type"
    return None
