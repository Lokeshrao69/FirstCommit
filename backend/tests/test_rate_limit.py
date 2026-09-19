"""Unit tests for rate limiter."""

from __future__ import annotations

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.core.rate_limit import SlidingWindowRateLimiter, rate_limit


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

    @app.get("/test", dependencies=[pytest.importorskip("fastapi").Depends(rate_limit(test_limiter))])
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
