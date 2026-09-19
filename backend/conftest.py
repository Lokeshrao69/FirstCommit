from __future__ import annotations

import os

# Pytest test suite defaults to DEMO_MODE=true for isolated in-memory unit tests
os.environ.setdefault("DEMO_MODE", "true")
