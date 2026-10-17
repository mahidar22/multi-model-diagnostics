from __future__ import annotations

import uuid
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from apps.api.app.api.v1.artifacts import router as artifacts_router
from apps.api.app.api.v1.auth import router as auth_router
from apps.api.app.api.v1.cases import router as cases_router
from apps.api.app.api.v1.evaluation import router as evaluation_router
from apps.api.app.api.v1.runs import router as runs_router
from apps.api.app.core.config import settings
from apps.api.app.core.errors import ApiError, api_error_handler, http_error_handler, unexpected_error_handler, validation_error_handler
from apps.api.app.storage.local import store
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from ml.inference import load_manifest


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Fail early on a malformed manifest or invalid local token configuration.
    store.initialize()
    load_manifest()
    settings.user_tokens
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=(
        "Research-only local prototype. Synthetic demonstration outputs are not diagnoses, "
        "treatment recommendations, or evidence of clinical performance."
    ),
    docs_url="/docs",
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID", "Content-Disposition"],
)

app.add_exception_handler(ApiError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(StarletteHTTPException, http_error_handler)
app.add_exception_handler(Exception, unexpected_error_handler)

@app.middleware("http")
async def privacy_and_request_metadata(request: Request, call_next):
    # Always mint a server-generated ID; never copy user-controlled header text into audit logs.
    request_id = uuid.uuid4().hex
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


api = APIRouter(prefix=settings.api_prefix)
api.include_router(auth_router)
api.include_router(cases_router)
api.include_router(artifacts_router)
api.include_router(runs_router)
api.include_router(evaluation_router)


@api.get("/health", tags=["health"])
def health():
    manifest = load_manifest()
    return {
        "status": "ok",
        "application": settings.app_name,
        "version": "0.1.0",
        "research_only": True,
        "task_id": manifest["task_id"],
        "task_name": manifest["task_name"],
        "task_version": manifest["task_version"],
        "model_version": manifest["model_version"],
        "configured_modality": manifest["input_modality"],
        "accepted_modalities": manifest["accepted_modalities"],
        "preprocessing_version": manifest["preprocessing"]["version"],
        "score_type": manifest["score_type"],
        "class_labels": manifest["class_labels"],
        "features": [{key: feature.get(key) for key in ("name", "label", "type", "minimum", "maximum", "unit")} for feature in manifest["features"]],
        "max_upload_bytes": settings.max_upload_bytes,
        "max_artifacts_per_case": settings.max_artifacts_per_case,
        "rag_enabled": settings.rag_enabled,
        "retention_days": settings.retention_days,
    }


app.include_router(api)
