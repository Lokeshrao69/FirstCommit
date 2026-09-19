from __future__ import annotations

import os
import pytest

# Pytest test suite defaults to DEMO_MODE=true for isolated in-memory unit tests
os.environ.setdefault("DEMO_MODE", "true")


@pytest.fixture(autouse=True)
def _reset_rate_limiters():
    from app.core.rate_limit import (
        document_upload_limiter,
        workflow_advance_limiter,
        workflow_generation_limiter,
    )

    workflow_generation_limiter.reset()
    document_upload_limiter.reset()
    workflow_advance_limiter.reset()
    yield
    workflow_generation_limiter.reset()
    document_upload_limiter.reset()
    workflow_advance_limiter.reset()
