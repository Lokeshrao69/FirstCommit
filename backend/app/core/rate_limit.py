"""In-memory sliding window rate limiter for public-facing API endpoints.

Protects expensive downstream services (Amazon Bedrock, Amazon Textract) from DoS
and cost overruns.
"""

from __future__ import annotations

import collections
import threading
import time
from typing import Callable

from fastapi import HTTPException, Request


class SlidingWindowRateLimiter:
    """Thread-safe sliding window rate limiter."""

    def __init__(self, max_requests: int, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, collections.deque[float]] = collections.defaultdict(collections.deque)
        self._lock = threading.Lock()

    def check(self, client_key: str) -> None:
        """Check if client exceeds rate limit. Raises HTTPException(429) if exceeded."""
        now = time.monotonic()
        cutoff = now - self.window_seconds

        with self._lock:
            timestamps = self._requests[client_key]
            while timestamps and timestamps[0] < cutoff:
                timestamps.popleft()

            if len(timestamps) >= self.max_requests:
                oldest = timestamps[0]
                retry_after = max(1, int(oldest + self.window_seconds - now))
                raise HTTPException(
                    status_code=429,
                    detail="Rate limit exceeded. Please try again later.",
                    headers={"Retry-After": str(retry_after)},
                )

            timestamps.append(now)

    def reset(self) -> None:
        """Clear all tracked request history (useful for test isolation)."""
        with self._lock:
            self._requests.clear()


# Default limiters for metered and state-advancing endpoints
workflow_generation_limiter = SlidingWindowRateLimiter(max_requests=20, window_seconds=60)
document_upload_limiter = SlidingWindowRateLimiter(max_requests=30, window_seconds=60)
workflow_advance_limiter = SlidingWindowRateLimiter(max_requests=60, window_seconds=60)


def get_client_ip(request: Request) -> str:
    """Extract client IP from request, taking X-Forwarded-For into account."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def rate_limit(limiter: SlidingWindowRateLimiter) -> Callable[[Request], None]:
    """FastAPI dependency for rate limiting by client IP."""

    def dependency(request: Request) -> None:
        client_key = get_client_ip(request)
        limiter.check(client_key)

    return dependency
