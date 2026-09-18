"""AWS implementations of the document interfaces.

- S3ObjectStore: private, encrypted S3 bucket, generated keys, MIME/size validated
  by the API layer before reaching here.
- TextractProcessor: extracts text using Amazon Textract.

These are only exercised when DEMO_MODE=false.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from .processor import DocumentObjectStore, DocumentProcessor

logger = logging.getLogger(__name__)


class S3ObjectStore(DocumentObjectStore):
    def __init__(self, bucket: str, region: str | Any = "us-east-1", client: Any = None) -> None:
        resolved_region = getattr(region, "aws_region", region) if not isinstance(region, str) else region
        if client is not None:
            self._s3 = client
        else:
            import boto3

            self._s3 = boto3.client("s3", region_name=resolved_region)
        self._bucket = bucket

    def put(self, key: str, content: bytes, mime_type: str) -> str:
        self._s3.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=content,
            ContentType=mime_type,
            ServerSideEncryption="AES256",
        )
        return f"s3://{self._bucket}/{key}"

    def delete(self, key: str) -> None:
        try:
            self._s3.delete_object(Bucket=self._bucket, Key=key)
            logger.info("deleted object bucket=%s key=%s", self._bucket, key)
        except Exception as exc:  # noqa: BLE001 - best effort cleanup, but never silent
            logger.warning("failed to delete object bucket=%s key=%s: %s", self._bucket, key, exc)


def generate_object_key(workflow_id: str, filename: str) -> str:
    safe = _sanitize_key_part(filename)
    return f"uploads/{workflow_id}/{uuid.uuid4().hex[:12]}_{safe}"


def _sanitize_key_part(filename: str) -> str:
    """Reduce a client-supplied filename to a safe S3 key suffix.

    Only the basename is used, so path traversal via ``/`` or ``\\`` is
    impossible; characters outside A-Z/a-z/0-9/._- are dropped, leading dots
    and underscores (which hide files) are stripped, and a degenerate result
    falls back to ``document``.
    """
    base = filename.replace("\\", "/").rsplit("/", 1)[-1].strip()
    safe = "".join(ch for ch in base if ch.isalnum() or ch in ". _-").replace(" ", "_")
    safe = safe.lstrip("._")
    return safe or "document"


class TextractProcessor(DocumentProcessor):
    def __init__(self, region: str | Any = "us-east-1", client: Any = None) -> None:
        resolved_region = getattr(region, "aws_region", region) if not isinstance(region, str) else region
        if client is not None:
            self._textract = client
        else:
            import boto3

            self._textract = boto3.client("textract", region_name=resolved_region)

    def extract_text(self, content: bytes, filename: str, mime_type: str) -> str:
        resp = self._textract.detect_document_text(Document={"Bytes": content})
        blocks = resp.get("Blocks", [])
        lines = [
            block["Text"]
            for block in blocks
            if block.get("BlockType") == "LINE" and block.get("Text")
        ]
        return "\n".join(lines)
