"""AWS implementations of the document interfaces.

- S3ObjectStore: private, encrypted S3 bucket, generated keys, MIME/size validated
  by the API layer before reaching here.
- TextractProcessor: extracts text using Amazon Textract.

These are only exercised when DEMO_MODE=false.
"""

from __future__ import annotations

import uuid
from typing import Any

from .processor import DocumentObjectStore, DocumentProcessor


class S3ObjectStore(DocumentObjectStore):
    def __init__(self, bucket: str, region: str = "us-east-1", client: Any = None) -> None:
        if client is not None:
            self._s3 = client
        else:
            import boto3

            self._s3 = boto3.client("s3", region_name=region)
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
        except Exception:  # noqa: BLE001 - best effort cleanup in demo context
            pass


def generate_object_key(workflow_id: str, filename: str) -> str:
    safe = "".join(c for c in filename if c.isalnum() or c in "._- ").replace(" ", "_")
    return f"uploads/{workflow_id}/{uuid.uuid4().hex[:12]}_{safe}"


class TextractProcessor(DocumentProcessor):
    def __init__(self, region: str = "us-east-1", client: Any = None) -> None:
        if client is not None:
            self._textract = client
        else:
            import boto3

            self._textract = boto3.client("textract", region_name=region)

    def extract_text(self, content: bytes, filename: str, mime_type: str) -> str:
        resp = self._textract.detect_document_text(Document={"Bytes": content})
        blocks = resp.get("Blocks", [])
        lines = [
            block["Text"]
            for block in blocks
            if block.get("BlockType") == "LINE" and block.get("Text")
        ]
        return "\n".join(lines)