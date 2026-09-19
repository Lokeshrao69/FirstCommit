"""Unit tests for rate limiters (DynamoDB distributed limiter and in-memory soft secondary)."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.rate_limit import (
    DynamoDBRateLimiter,
    SlidingWindowRateLimiter,
    rate_limit,
)


def test_sliding_window_rate_limiter_blocks_excess_requests():
    limiter = SlidingWindowRateLimiter(max_requests=3, window_seconds=60)
    # 3 requests allowed
    limiter.check("client-1")
    limiter.check("client-1")
    limiter.check("client-1")

    # 4th request must raise HTTPException(429)
    with pytest.raises(HTTPException) as exc_info:
        limiter.check("client-1")
    assert exc_info.value.status_code == 429
    assert "Retry-After" in exc_info.value.headers
    assert int(exc_info.value.headers["Retry-After"]) >= 1

    # Different client is unaffected
    limiter.check("client-2")


def test_rate_limiter_reset():
    limiter = SlidingWindowRateLimiter(max_requests=1, window_seconds=60)
    limiter.check("client-1")
    with pytest.raises(HTTPException):
        limiter.check("client-1")

    limiter.reset()
    # Now allowed again
    limiter.check("client-1")


def test_rate_limit_fastapi_dependency():
    test_limiter = SlidingWindowRateLimiter(max_requests=2, window_seconds=60)
    app = FastAPI()

    @app.get("/test", dependencies=[Depends(rate_limit(test_limiter))])
    def endpoint():
        return {"status": "ok"}

    client = TestClient(app)
    r1 = client.get("/test", headers={"X-Forwarded-For": "1.2.3.4"})
    assert r1.status_code == 200

    r2 = client.get("/test", headers={"X-Forwarded-For": "1.2.3.4"})
    assert r2.status_code == 200

    r3 = client.get("/test", headers={"X-Forwarded-For": "1.2.3.4"})
    assert r3.status_code == 429
    assert "Retry-After" in r3.headers


def test_dynamodb_rate_limiter_atomic_increment(monkeypatch):
    monkeypatch.setattr(
        "app.core.config.get_settings",
        lambda: Settings({"DEMO_MODE": "false", "AWS_DYNAMODB_TABLE_RATE_LIMITS": "test-table"}),
    )
    mock_client = MagicMock()
    mock_client.update_item.return_value = {"Attributes": {"request_count": {"N": "1"}}}

    limiter = DynamoDBRateLimiter(
        endpoint_name="test_endpoint",
        max_requests=2,
        window_seconds=60,
        table_name="test-table",
        dynamodb_client=mock_client,
    )

    # 1st request succeeds
    limiter.check("10.0.0.1")
    assert mock_client.update_item.called
    call_kwargs = mock_client.update_item.call_args[1]
    assert call_kwargs["TableName"] == "test-table"
    assert "rl:10.0.0.1:test_endpoint:" in call_kwargs["Key"]["pk"]["S"]

    # 2nd request at limit
    mock_client.update_item.return_value = {"Attributes": {"request_count": {"N": "2"}}}
    limiter.check("10.0.0.1")

    # 3rd request exceeds limit
    mock_client.update_item.return_value = {"Attributes": {"request_count": {"N": "3"}}}
    with pytest.raises(HTTPException) as exc_info:
        limiter.check("10.0.0.1")
    assert exc_info.value.status_code == 429
    assert "Retry-After" in exc_info.value.headers


def test_dynamodb_rate_limiter_falls_back_to_in_memory_on_error(monkeypatch):
    monkeypatch.setattr(
        "app.core.config.get_settings",
        lambda: Settings({"DEMO_MODE": "false", "AWS_DYNAMODB_TABLE_RATE_LIMITS": "test-table"}),
    )
    mock_client = MagicMock()
    mock_client.update_item.side_effect = RuntimeError("DynamoDB unreachable")

    limiter = DynamoDBRateLimiter(
        endpoint_name="test_endpoint",
        max_requests=2,
        window_seconds=60,
        table_name="test-table",
        dynamodb_client=mock_client,
    )

    # Falls back to in-memory limiter; allows 2 requests
    limiter.check("10.0.0.2")
    limiter.check("10.0.0.2")

    # 3rd request blocked by in-memory fallback
    with pytest.raises(HTTPException) as exc_info:
        limiter.check("10.0.0.2")
    assert exc_info.value.status_code == 429


def test_dynamodb_rate_limiter_uses_fallback_in_demo_mode(monkeypatch):
    monkeypatch.setattr(
        "app.core.config.get_settings",
        lambda: Settings({"DEMO_MODE": "true", "AWS_DYNAMODB_TABLE_RATE_LIMITS": "test-table"}),
    )
    mock_client = MagicMock()

    limiter = DynamoDBRateLimiter(
        endpoint_name="test_endpoint",
        max_requests=1,
        window_seconds=60,
        table_name="test-table",
        dynamodb_client=mock_client,
    )

    limiter.check("10.0.0.3")
    # DynamoDB client not called in demo mode
    assert not mock_client.update_item.called

    with pytest.raises(HTTPException):
        limiter.check("10.0.0.3")
