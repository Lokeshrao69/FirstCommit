"""Fail-closed composition-root tests (section 4A).

Outside DEMO_MODE a missing production service must surface as
ServiceConfigurationError unless ALLOW_MOCK_FALLBACK=true. MOCK_LLM=true stays
an explicit, supported opt-in to the mock LLM and never counts as a fallback.
"""

from __future__ import annotations

import pytest

from app.ai.mock_llm_provider import MockLLMProvider
from app.api import deps
from app.api.deps import Services
from app.core.config import ServiceConfigurationError, Settings
from app.documents.mock_processor import MockDocumentProcessor, MockObjectStore
from app.storage.in_memory import InMemoryRepository

_BASE = {
    "DEMO_MODE": "false",
    "MOCK_LLM": "false",
    "ALLOW_MOCK_FALLBACK": "false",
    "PURGE_DOCUMENTS_ON_COMPLETION": "true",
}

_AWS = ("BedrockProvider", "DynamoRepository", "S3ObjectStore", "TextractProcessor")


def _failing(component: str):
    def __init__(self, *args, **kwargs):
        raise RuntimeError(f"{component} unavailable in fail-closed test")

    __init__.__name__ = "fail"
    return type(component, (), {"__init__": __init__})


def _monkeypatch_fail(monkeypatch, components: tuple[str, ...]) -> None:
    for component in components:
        monkeypatch.setattr(deps, component, _failing(component))


def test_allow_mock_fallback_defaults_to_false():
    settings = Settings(_BASE)
    assert settings.allow_mock_fallback is False


def test_purge_documents_on_completion_defaults_to_true():
    assert Settings(_BASE).purge_documents_on_completion is True
    assert Settings({**_BASE, "PURGE_DOCUMENTS_ON_COMPLETION": "false"}).purge_documents_on_completion is False


def test_service_configuration_error_is_runtime_error():
    assert issubclass(ServiceConfigurationError, RuntimeError)


def test_llm_fails_closed_when_bedrock_unavailable(monkeypatch):
    _monkeypatch_fail(monkeypatch, ("BedrockProvider",))
    with pytest.raises(ServiceConfigurationError, match="ALLOW_MOCK_FALLBACK"):
        Services(Settings(_BASE))


def test_repo_fails_closed_when_dynamo_unavailable(monkeypatch):
    _monkeypatch_fail(monkeypatch, ("DynamoRepository",))
    with pytest.raises(ServiceConfigurationError, match="ALLOW_MOCK_FALLBACK"):
        Services(Settings(_BASE))


def test_documents_fail_closed_when_aws_storage_unavailable(monkeypatch):
    _monkeypatch_fail(monkeypatch, ("S3ObjectStore", "TextractProcessor"))
    with pytest.raises(ServiceConfigurationError, match="ALLOW_MOCK_FALLBACK"):
        Services(Settings(_BASE))


def test_allow_mock_fallback_re_enables_fallback(monkeypatch):
    _monkeypatch_fail(monkeypatch, _AWS)
    services = Services(Settings({**_BASE, "ALLOW_MOCK_FALLBACK": "true"}))
    assert services.storage_mode == "aws_fallback"
    assert isinstance(services.llm, MockLLMProvider)
    assert isinstance(services.repo, InMemoryRepository)
    assert isinstance(services.store, MockObjectStore)
    assert isinstance(services.processor, MockDocumentProcessor)


def test_mock_llm_optin_works_without_bedrock(monkeypatch):
    _monkeypatch_fail(monkeypatch, _AWS)
    services = Services(Settings({**_BASE, "MOCK_LLM": "true", "ALLOW_MOCK_FALLBACK": "true"}))
    assert isinstance(services.llm, MockLLMProvider)


def test_demo_mode_uses_mocks_without_fail_closed(monkeypatch):
    _monkeypatch_fail(monkeypatch, _AWS)
    services = Services(Settings({**_BASE, "DEMO_MODE": "true"}))
    assert services.storage_mode == "demo"
    assert isinstance(services.llm, MockLLMProvider)
    assert isinstance(services.repo, InMemoryRepository)
    assert isinstance(services.store, MockObjectStore)
    assert isinstance(services.processor, MockDocumentProcessor)
