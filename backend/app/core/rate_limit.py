"""Distributed rate limiting for public-facing API endpoints.

Protects expensive downstream services (Amazon Bedrock, Amazon Textract) from DoS
and cost overruns across concurrent serverless Lambda execution environments.

Architecture:
1. Primary / Infrastructure layer: API Gateway DefaultRouteSettings in template.yaml
   enforces perimeter burst and rate throttling before requests reach Lambda.
2. Distributed application layer: DynamoDBRateLimiter uses atomic counter updates
   in DynamoDB (RateLimitsTable) with native TTL auto-eviction. Atomic `UpdateItem`
   with `ADD request_count :inc` guarantees consistent distributed rate enforcement
   across all concurrent Lambda execution environments with zero distributed locks.
3. In-memory soft secondary limiter: SlidingWindowRateLimiter acts as a soft secondary
   fallback during local development, unit testing, and DEMO_MODE, or when DynamoDB
   is unreachable.
"""

from __future__ import annotations

import collections
import logging
import threading
import time
from typing import Any, Callable

from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)


class SlidingWindowRateLimiter:
    """Thread-safe sliding window rate limiter for single-process / demo fallback."""

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


class DynamoDBRateLimiter:
    """Distributed rate limiter backed by a DynamoDB counter table with TTL expiration.

    Uses atomic UpdateItem with ADD to increment a request counter for a given client
    within a discrete fixed time window. Old records are auto-deleted by DynamoDB TTL.
    """

    def __init__(
        self,
        endpoint_name: str,
        max_requests: int,
        window_seconds: int = 60,
        table_name: str | None = None,
        region_name: str | None = None,
        dynamodb_client: Any = None,
    ) -> None:
        self.endpoint_name = endpoint_name
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.table_name = table_name
        self.region_name = region_name
        self._client = dynamodb_client
        self._in_memory_fallback = SlidingWindowRateLimiter(max_requests, window_seconds)

    def _get_client(self) -> Any:
        if self._client is not None:
            return self._client
        import boto3

        from app.core.config import get_settings

        settings = get_settings()
        region = self.region_name or settings.aws_region
        self._client = boto3.client("dynamodb", region_name=region)
        return self._client

    def check(self, client_key: str) -> None:
        """Check if client exceeds rate limit.

        Performs an atomic increment on DynamoDB counter table.
        Falls back to in-memory secondary limiter if in demo_mode or if DynamoDB fails.
        """
        from app.core.config import get_settings

        settings = get_settings()
        table = self.table_name or settings.aws_ddb_rate_limits

        if settings.demo_mode or not table:
            self._in_memory_fallback.check(client_key)
            return

        now = int(time.time())
        window_id = now // self.window_seconds
        pk = f"rl:{client_key}:{self.endpoint_name}:{window_id}"
        # Expire 2 windows into the future for automatic TTL cleanup by DynamoDB
        expires_at = (window_id + 2) * self.window_seconds

        try:
            client = self._get_client()
            response = client.update_item(
                TableName=table,
                Key={"pk": {"S": pk}},
                UpdateExpression="ADD request_count :inc SET expires_at = if_not_exists(expires_at, :ttl)",
                ExpressionAttributeValues={
                    ":inc": {"N": "1"},
                    ":ttl": {"N": str(expires_at)},
                },
                ReturnValues="ALL_NEW",
            )
            count = int(response.get("Attributes", {}).get("request_count", {}).get("N", "1"))
            if count > self.max_requests:
                window_end = (window_id + 1) * self.window_seconds
                retry_after = max(1, window_end - now)
                raise HTTPException(
                    status_code=429,
                    detail="Rate limit exceeded. Please try again later.",
                    headers={"Retry-After": str(retry_after)},
                )
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning(
                "DynamoDB rate limit check failed (%s); falling back to in-memory limiter",
                exc,
            )
            self._in_memory_fallback.check(client_key)

    def reset(self) -> None:
        """Reset in-memory fallback state."""
        self._in_memory_fallback.reset()


# Default limiters for metered and state-advancing endpoints
workflow_generation_limiter = DynamoDBRateLimiter(endpoint_name="create_workflow", max_requests=20, window_seconds=60)
document_upload_limiter = DynamoDBRateLimiter(endpoint_name="upload_document", max_requests=30, window_seconds=60)
workflow_advance_limiter = DynamoDBRateLimiter(endpoint_name="advance_workflow", max_requests=60, window_seconds=60)


def get_client_ip(request: Request) -> str:
    """Extract client IP from request, taking X-Forwarded-For into account."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def rate_limit(limiter: DynamoDBRateLimiter | SlidingWindowRateLimiter) -> Callable[[Request], None]:
    """FastAPI dependency for rate limiting by client IP."""

    def dependency(request: Request) -> None:
        client_key = get_client_ip(request)
        limiter.check(client_key)

    return dependency
