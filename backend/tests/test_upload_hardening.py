"""Upload + storage hardening tests.

Covers magic-byte sniffing, strict (production) content/type validation,
DEMO_MODE leniency for the frontend demo shortcut payloads, and object-key
sanitization.
"""

from __future__ import annotations

import os

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import deps
from app.api.deps import get_services
from app.api.routes import router
from app.core.config import get_settings
from app.documents.aws_processor import generate_object_key
from app.documents.content_sniff import sniff_mime, validate_upload_content

ALLOWED = ["application/pdf", "image/png", "image/jpeg"]

PDF = b"%PDF-1.7 faked but starts with the PDF magic"
BOM_PDF = b"\xef\xbb\xbf%PDF-1.7 bom-prefixed"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 8
TEXT = b"demo ok"  # the frontend demo shortcut payload (plain text named .pdf)

DEMO_GOAL = "I want to apply for the Merit Excellence Scholarship"


@pytest.fixture(autouse=True)
def _reset_settings() -> None:
    yield
    os.environ.pop("DEMO_MODE", None)
    get_settings.cache_clear()
    get_services.cache_clear()


def _offline_client(monkeypatch, demo: bool) -> TestClient:
    """Non-demo client where AWS init is forced to fail, so Services falls
    back to in-memory/mock components while settings.demo_mode stays as set."""
    os.environ["DEMO_MODE"] = "true" if demo else "false"
    get_settings.cache_clear()
    get_services.cache_clear()

    def fail(self, *args, **kwargs):
        raise RuntimeError("AWS unavailable in offline tests")

    for name in ("BedrockProvider", "DynamoRepository", "S3ObjectStore", "TextractProcessor"):
        fail.__name__ = name
        monkeypatch.setattr(deps, name, type(name, (), {"__init__": fail}))
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


# ------------------------------------------------------------------- sniffing


def test_sniff_mime_detects_allowed_types():
    assert sniff_mime(PDF) == "application/pdf"
    assert sniff_mime(BOM_PDF) == "application/pdf"
    assert sniff_mime(PNG) == "image/png"
    assert sniff_mime(JPEG) == "image/jpeg"


def test_sniff_mime_is_conservative_for_unknown_or_empty():
    assert sniff_mime(TEXT) is None
    assert sniff_mime(b"") is None


# ------------------------------------------------------------ strict validation


def _strict(mime: str, content: bytes) -> str | None:
    return validate_upload_content(mime=mime, content=content, allowed_mime_types=ALLOWED, strict=True)


def _lenient(mime: str, content: bytes) -> str | None:
    return validate_upload_content(mime=mime, content=content, allowed_mime_types=ALLOWED, strict=False)


def test_strict_validation_rejects_declared_type_mismatch():
    assert _strict("application/pdf", PNG) is not None
    assert _strict("image/png", JPEG) is not None
    assert _strict("image/png", PDF) is not None


def test_strict_validation_allows_matching_unrecognized_types():
    assert _strict("application/pdf", PDF) is None
    assert _strict("image/png", PNG) is None
    assert _strict("application/pdf", TEXT) is None


# ------------------------------------------------------ demo (lenient) mode


def test_lenient_validation_always_accepts_demo_payloads():
    assert _lenient("application/pdf", TEXT) is None
    assert _lenient("image/png", TEXT) is None
    assert _lenient("application/pdf", b"") is None


def test_demo_route_accepts_plain_text_named_pdf(monkeypatch):
    client = _offline_client(monkeypatch, demo=True)
    wid = client.post("/workflows", json={"goal": DEMO_GOAL}).json()["workflow_id"]
    client.post(f"/workflows/{wid}/advance", json={})
    r = client.post(
        f"/workflows/{wid}/documents",
        files={"file": ("transcript.pdf", TEXT, "application/pdf")},
    )
    assert r.status_code == 200, r.text


# ------------------------------------------------------ empty-file rejection


def test_empty_upload_rejected_with_400_in_demo_mode(monkeypatch):
    client = _offline_client(monkeypatch, demo=True)
    wid = client.post("/workflows", json={"goal": DEMO_GOAL}).json()["workflow_id"]
    client.post(f"/workflows/{wid}/advance", json={})
    r = client.post(
        f"/workflows/{wid}/documents",
        files={"file": ("transcript.pdf", b"", "application/pdf")},
    )
    assert r.status_code == 400
    assert "empty" in r.json()["detail"].lower()


def test_empty_upload_rejected_with_400_outside_demo_mode(monkeypatch):
    client = _offline_client(monkeypatch, demo=False)
    wid = client.post("/workflows", json={"goal": DEMO_GOAL}).json()["workflow_id"]
    client.post(f"/workflows/{wid}/advance", json={})
    r = client.post(
        f"/workflows/{wid}/documents",
        files={"file": ("transcript.pdf", b"", "application/pdf")},
    )
    assert r.status_code == 400
    assert "empty" in r.json()["detail"].lower()


# ------------------------------------------------------ strict route wiring


def test_strict_route_rejects_mismatch_and_accepts_match(monkeypatch):
    client = _offline_client(monkeypatch, demo=False)
    wid = client.post("/workflows", json={"goal": DEMO_GOAL}).json()["workflow_id"]
    client.post(f"/workflows/{wid}/advance", json={})

    r = client.post(
        f"/workflows/{wid}/documents",
        files={"file": ("transcript.pdf", PNG, "application/pdf")},
    )
    assert r.status_code == 415
    assert "content" in r.json()["detail"].lower()

    r = client.post(
        f"/workflows/{wid}/documents",
        files={"file": ("transcript.pdf", PDF, "application/pdf")},
    )
    assert r.status_code == 200, r.text


# ------------------------------------------------------ object key hardening


def test_generate_object_key_blocks_path_traversal():
    for hostile in ("../../etc/evil.pdf", "..\\..\\evil.pdf", "evil.pdf"):
        key = generate_object_key("wf-1", hostile)
        assert ".." not in key
        assert "/" not in key.rsplit("/", 1)[1]
        assert key.startswith("uploads/wf-1/")
        assert key.endswith("_evil.pdf")


def test_generate_object_key_falls_back_to_document():
    assert generate_object_key("wf-1", "..").endswith("_document")


def test_generate_object_key_is_unique_per_upload():
    a = generate_object_key("wf-1", "transcript.pdf")
    b = generate_object_key("wf-1", "transcript.pdf")
    assert a != b
