from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.deps import get_services
from app.api.routes import router
from app.core.config import get_settings
from app.core.logging_config import configure_logging

settings = get_settings()
configure_logging(settings.log_level)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm the composition root so providers are constructed once on startup.
    try:
        get_services()
    except Exception as exc:
        logging.getLogger(__name__).warning("Composition root warm-up deferred: %s", exc)
    yield


app = FastAPI(
    title="FlowForge API",
    description="From intent to execution. The LLM plans, the state machine executes, the human stays in control.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health() -> dict:
    curr_settings = get_settings()
    return {
        "status": "healthy",
        "app": curr_settings.app_name,
        "environment": curr_settings.environment,
        "demo_mode": curr_settings.demo_mode,
        "user": curr_settings.demo_user_id,
    }


@app.get("/")
def root() -> dict:
    return {"name": "FlowForge", "docs": "/docs", "health": "/health"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=settings.environment == "development",
    )
