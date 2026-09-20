"""Service + document-type catalog.

Maps a plain-language goal to a government service, loading the reference data
(required documents, deterministic rules, workflow template) from the knowledge
directory. `match` is pure keyword scoring with a documented default, so a
vague goal always lands on the flagship post-matric scholarship demo.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

DEFAULT_SERVICE_ID = "post_matric_scholarship"


class ServiceCatalog:
    def __init__(self, document_types_path: Path, services_dir: Path) -> None:
        self._document_types_path = document_types_path
        self._services_dir = services_dir
        self._document_types = self._load_json(document_types_path)["document_types"]
        self._services = [
            self._load_json(p)
            for p in sorted(services_dir.glob("*.json"))
        ]
        ids = [s["id"] for s in self._services]
        if DEFAULT_SERVICE_ID not in ids:
            raise ValueError(f"knowledge catalog has no default service '{DEFAULT_SERVICE_ID}'")

    @staticmethod
    def _load_json(path: Path) -> dict[str, Any]:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)

    def doc_types(self) -> dict[str, dict[str, Any]]:
        return {t["id"]: t for t in self._document_types}

    def services(self) -> list[dict[str, Any]]:
        return self._services

    def get_service(self, service_id: str):
        for svc in self._services:
            if svc["id"] == service_id:
                return svc
        raise KeyError(f"unknown service '{service_id}'")

    def default_service(self) -> dict[str, Any]:
        return self.get_service(DEFAULT_SERVICE_ID)

    def sensitive_fields(self) -> dict[str, list[str]]:
        return {t["id"]: list(t.get("sensitive_fields", [])) for t in self._document_types}

    def match(self, goal: str) -> dict[str, Any]:
        """Best-scoring service for a goal, else the default service."""
        text = goal.lower()
        tokens = _tokenize(text)
        best = self.default_service()
        best_score = 0
        for svc in self._services:
            keywords = [w.lower() for w in svc.get("keywords", [])]
            keyword_set = set(keywords)
            score = sum(1 for w in keywords if w in text) + sum(
                1 for token in tokens if token in keyword_set
            )
            if score > best_score:
                best, best_score = svc, score
        return best


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())
