"""Application composition root.

Selects real vs. mock implementations based on DEMO_MODE, so the whole application
runs locally without AWS credentials and deploys unchanged on Lambda.

Fail-closed rule (4A): outside DEMO_MODE a service that cannot be initialized is an
error, never a silent fallback. The only escape hatch is ALLOW_MOCK_FALLBACK=true.
MOCK_LLM=true is an explicit, supported opt-in and keeps working regardless.
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from ..ai.bedrock_provider import BedrockProvider
from ..ai.llm_provider import LLMProvider
from ..ai.mock_llm_provider import MockLLMProvider
from ..ai.workflow_generator import WorkflowGenerator
from ..core.config import ServiceConfigurationError, Settings, get_settings
from ..documents.aws_processor import (
    S3ObjectStore,
    TextractProcessor,
    generate_object_key,
)
from ..documents.mock_processor import MockDocumentProcessor, MockObjectStore
from ..services.document_service import DocumentService
from ..services.workflow_service import WorkflowService
from ..storage.dynamo import DynamoRepository
from ..storage.in_memory import InMemoryRepository
from ..storage.repository import WorkflowRepository

logger = logging.getLogger(__name__)

_KNOWLEDGE_PATH = Path(__file__).resolve().parents[2] / "knowledge" / "scholarship_process.json"


class Services:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.knowledge = _load_knowledge(_KNOWLEDGE_PATH)
        self._fallback_used = False
        self.llm: LLMProvider = self._build_llm()
        self.repo: WorkflowRepository = self._build_repo()
        self.store, self.processor = self._build_documents()
        self.generator = WorkflowGenerator(self.llm, settings)
        self.document_service = DocumentService(
            repo=self.repo,
            store=self.store,
            processor=self.processor,
            llm=self.llm,
            object_key_fn=generate_object_key,
        )
        self.workflow_service = WorkflowService(
            self.repo,
            self.generator,
            self.llm,
            settings,
            self.knowledge,
            document_service=self.document_service,
            purge_documents_on_completion=settings.purge_documents_on_completion,
        )
        self.storage_mode = self._resolved_storage_mode()
        logger.info(
            "startup storage_mode=%s demo_mode=%s allow_mock_fallback=%s",
            self.storage_mode,
            settings.demo_mode,
            settings.allow_mock_fallback,
        )

    def _build_llm(self) -> LLMProvider:
        if self.settings.demo_mode or self.settings.mock_llm:
            logger.info(
                "Mock LLM enabled: demo_mode=%s mock_llm=%s",
                self.settings.demo_mode,
                self.settings.mock_llm,
            )
            return MockLLMProvider()

        try:
            return BedrockProvider(self.settings)
        except Exception as exc:  # noqa: BLE001 - normalized => fail closed or fallback
            if not self.settings.allow_mock_fallback:
                raise ServiceConfigurationError(
                    "BedrockProvider could not be initialized and ALLOW_MOCK_FALLBACK is disabled"
                ) from exc
            self._fallback_used = True
            logger.warning(
                "BedrockProvider unavailable (%s); falling back to MockLLMProvider "
                "(ALLOW_MOCK_FALLBACK=true)",
                exc,
            )
            return MockLLMProvider()

    def _build_repo(self) -> WorkflowRepository:
        if self.settings.demo_mode:
            return InMemoryRepository()
        try:
            return DynamoRepository(
                table_workflows=self.settings.aws_ddb_workflows,
                table_documents=self.settings.aws_ddb_documents,
                table_audit=self.settings.aws_ddb_audit,
                region=self.settings.aws_region,
            )
        except Exception as exc:  # noqa: BLE001
            if not self.settings.allow_mock_fallback:
                raise ServiceConfigurationError(
                    "DynamoRepository could not be initialized and ALLOW_MOCK_FALLBACK is disabled"
                ) from exc
            self._fallback_used = True
            logger.warning(
                "DynamoRepository unavailable (%s); falling back to InMemoryRepository "
                "(ALLOW_MOCK_FALLBACK=true)",
                exc,
            )
            return InMemoryRepository()

    def _build_documents(self):
        if self.settings.demo_mode:
            return MockObjectStore(), MockDocumentProcessor()
        try:
            return (
                S3ObjectStore(self.settings.aws_s3_bucket, self.settings.aws_region),
                TextractProcessor(self.settings.aws_region),
            )
        except Exception as exc:  # noqa: BLE001
            if not self.settings.allow_mock_fallback:
                raise ServiceConfigurationError(
                    "AWS document services could not be initialized and "
                    "ALLOW_MOCK_FALLBACK is disabled"
                ) from exc
            self._fallback_used = True
            logger.warning(
                "AWS document services unavailable (%s); falling back to mocks "
                "(ALLOW_MOCK_FALLBACK=true)",
                exc,
            )
            return MockObjectStore(), MockDocumentProcessor()

    def _resolved_storage_mode(self) -> str:
        if self.settings.demo_mode:
            return "demo"
        if self._fallback_used:
            return "aws_fallback"
        return "aws"


@lru_cache
def get_services() -> Services:
    return Services(get_settings())


def _load_knowledge(path: Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)
