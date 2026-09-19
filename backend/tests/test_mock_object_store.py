"""Bounded MockObjectStore tests (section 4D).

Verifies the byte/object budgets and oldest-first eviction that mirror the S3
object lifecycle, plus the default limits used by the demo composition root.
"""

from __future__ import annotations

import pytest

from app.documents.mock_processor import (
    DEFAULT_MAX_BYTES,
    DEFAULT_MAX_OBJECTS,
    MockObjectStore,
)


def test_default_limits_are_sane_for_demo():
    store = MockObjectStore()
    assert store._max_bytes == DEFAULT_MAX_BYTES == 50 * 1024 * 1024
    assert store._max_objects == DEFAULT_MAX_OBJECTS == 500


def test_rejects_non_positive_limits():
    with pytest.raises(ValueError):
        MockObjectStore(max_bytes=0)
    with pytest.raises(ValueError):
        MockObjectStore(max_objects=0)


def test_evicts_oldest_when_object_count_exceeded():
    store = MockObjectStore(max_bytes=1024, max_objects=3)
    for i in range(4):
        store.put(f"uploads/key_{i}.pdf", b"x", "application/pdf")

    assert list(store._blobs) == ["uploads/key_1.pdf", "uploads/key_2.pdf", "uploads/key_3.pdf"]
    assert "uploads/key_0.pdf" not in store._blobs


def test_evicts_oldest_when_byte_budget_exceeded():
    store = MockObjectStore(max_bytes=10, max_objects=100)
    store.put("uploads/first.pdf", b"12345", "application/pdf")
    store.put("uploads/second.pdf", b"12345", "application/pdf")
    store.put("uploads/third.pdf", b"33333", "application/pdf")
    total = sum(len(b) for b in store._blobs.values())
    assert total <= 10
    assert "uploads/first.pdf" not in store._blobs
    assert "uploads/second.pdf" in store._blobs
    assert "uploads/third.pdf" in store._blobs


def test_delete_frees_byte_budget_and_object_slot():
    store = MockObjectStore(max_bytes=10, max_objects=100)
    store.put("uploads/first.pdf", b"123456", "application/pdf")
    store.delete("uploads/first.pdf")
    assert store._blobs == {}
    assert store._total_bytes == 0

    store.put("uploads/next.pdf", b"123456", "application/pdf")
    assert "uploads/next.pdf" in store._blobs


def test_overwrite_moves_key_to_newest():
    store = MockObjectStore(max_bytes=10, max_objects=2)
    store.put("uploads/a.pdf", b"11111", "application/pdf")
    store.put("uploads/b.pdf", b"22222", "application/pdf")
    # re-put "a" so it becomes the newest and survives the next put
    store.put("uploads/a.pdf", b"11111", "application/pdf")
    store.put("uploads/c.pdf", b"33333", "application/pdf")

    assert "uploads/b.pdf" not in store._blobs
    assert "uploads/a.pdf" in store._blobs
    assert "uploads/c.pdf" in store._blobs
