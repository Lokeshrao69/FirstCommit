"""Infrastructure template hardening tests (section 4E).

Verifies the SAM template denies non-TLS access, aborts incomplete multipart
uploads after one day, and enforces bucket ownership on the document bucket.
"""

from __future__ import annotations

from pathlib import Path

_TEMPLATE = Path(__file__).resolve().parents[2] / "infrastructure" / "template.yaml"


def _template_text() -> str:
    return _TEMPLATE.read_text(encoding="utf-8")


def test_template_denies_non_tls_access():
    text = _template_text()
    assert 'Action: "s3:*"' in text
    assert 'aws:SecureTransport: "false"' in text
    assert "DenyNonTlsRequests" in text


def test_template_aborts_incomplete_multipart_uploads_after_one_day():
    text = _template_text()
    assert "AbortIncompleteMultipartUpload:" in text
    assert "DaysAfterInitiation: 1" in text


def test_template_enforces_bucket_owner_control():
    text = _template_text()
    assert "ObjectOwnership: BucketOwnerEnforced" in text


def test_template_keeps_unencrypted_upload_denial():
    text = _template_text()
    assert 's3:x-amz-server-side-encryption: AES256' in text
