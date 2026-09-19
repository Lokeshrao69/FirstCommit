"""Central application configuration (env-driven)."""

from __future__ import annotations

import json
import os
from functools import lru_cache


class Settings:
    def __init__(self, env: dict[str, str] | None = None) -> None:
        env = env or os.environ
        self.app_name: str = env.get("APP_NAME", "FlowForge")
        self.environment: str = env.get("ENVIRONMENT", "development")
        self.log_level: str = env.get("LOG_LEVEL", "INFO")
        self.demo_mode: bool = env.get("DEMO_MODE", "false").lower() in {"1", "true", "yes"}
        self.mock_llm: bool = env.get("MOCK_LLM", "false").lower() in {"1", "true", "yes"}
        self.demo_user_id: str = env.get("DEMO_USER_ID", "demo-user")

        raw_origins = env.get("CORS_ORIGINS", "")
        if raw_origins:
            try:
                self.cors_origins: list[str] = json.loads(raw_origins)
            except json.JSONDecodeError:
                self.cors_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
        else:
            self.cors_origins = []

        frontend_domain = env.get("FRONTEND_DOMAIN", "").strip()
        if frontend_domain and frontend_domain not in self.cors_origins:
            self.cors_origins.append(frontend_domain)

        # In non-production, include localhost defaults for local developer workflow
        if self.environment != "production":
            for dev_origin in ["http://localhost:5173", "http://127.0.0.1:5173"]:
                if dev_origin not in self.cors_origins:
                    self.cors_origins.append(dev_origin)

        self.aws_region: str = env.get(
            "AWS_REGION",
            env.get("AWS_DEFAULT_REGION", "us-east-1"),
        )
        self.bedrock_region: str = env.get("BEDROCK_REGION", "us-east-1")
        self.bedrock_model_id: str = env.get(
            "BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20240620-v1:0"
        )
        self.bedrock_fast_model_id: str = env.get(
            "BEDROCK_FAST_MODEL_ID", "anthropic.claude-3-5-haiku-20241022-v1:0"
        )
        self.bedrock_max_retries: int = int(env.get("BEDROCK_MAX_RETRIES", "3"))
        self.bedrock_retry_base_seconds: float = float(
            env.get("BEDROCK_RETRY_BASE_SECONDS", "1.0")
        )

        self.aws_s3_bucket: str = env.get("AWS_S3_BUCKET", "flowforge-documents")
        self.aws_ddb_workflows: str = env.get(
            "AWS_DYNAMODB_TABLE_WORKFLOWS", "flowforge-workflows"
        )
        self.aws_ddb_documents: str = env.get(
            "AWS_DYNAMODB_TABLE_DOCUMENTS", "flowforge-documents"
        )
        self.aws_ddb_audit: str = env.get("AWS_DYNAMODB_TABLE_AUDIT", "flowforge-audit")
        self.aws_ddb_rate_limits: str = env.get(
            "AWS_DYNAMODB_TABLE_RATE_LIMITS", "flowforge-ratelimits"
        )

        self.max_document_size_mb: int = int(env.get("MAX_DOCUMENT_SIZE_MB", "10"))
        raw_mime = env.get("ALLOWED_MIME_TYPES", '["application/pdf","image/png","image/jpeg"]')
        try:
            self.allowed_mime_types: list[str] = json.loads(raw_mime)
        except json.JSONDecodeError:
            self.allowed_mime_types = ["application/pdf", "image/png", "image/jpeg"]

        self.confidence_pass: float = float(env.get("CONFIDENCE_PASS", "0.85"))
        self.confidence_warn: float = float(env.get("CONFIDENCE_WARN", "0.60"))
        self.workflow_retry_on_invalid: bool = (
            env.get("WORKFLOW_RETRY_ON_INVALID", "true").lower() in {"1", "true", "yes"}
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


def override_settings(env: dict[str, str]) -> Settings:
    get_settings.cache_clear()
    return Settings(env)
