from __future__ import annotations

import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Request, UploadFile

from apps.api.app.core.config import settings
from apps.api.app.core.errors import ApiError
from apps.api.app.core.security import get_current_actor
from apps.api.app.schemas.contracts import ArtifactValidationRequest
from apps.api.app.services.artifacts import sha256_hex, validate_csv
from apps.api.app.storage.local import store, utc_now
from ml.inference import load_manifest

router = APIRouter(tags=["artifacts"])
Actor = Annotated[str, Depends(get_current_actor)]


@router.post("/cases/{case_id}/artifacts", status_code=201)
async def upload_artifact(case_id: str, request: Request, actor_id: Actor, file: UploadFile = File(...)):
    case_record = store.get_owned_case(case_id, actor_id)
    if len(case_record.get("artifacts", [])) >= settings.max_artifacts_per_case:
        raise ApiError(409, "ARTIFACT_LIMIT_REACHED", f"This local demo allows at most {settings.max_artifacts_per_case} artifacts per case.")
    # Filename is examined only for its extension; it is never stored or used as a path.
    suffix = Path(file.filename or "").suffix.lower()
    if suffix != ".csv":
        raise ApiError(415, "UNSUPPORTED_FILE_TYPE", "This configured demo accepts CSV uploads only.")

    parts: list[bytes] = []
    size = 0
    while True:
        block = await file.read(64 * 1024)
        if not block:
            break
        size += len(block)
        if size > settings.max_upload_bytes:
            raise ApiError(413, "UPLOAD_TOO_LARGE", f"Upload exceeds the configured {settings.max_upload_bytes // (1024 * 1024)} MB limit.")
        parts.append(block)
    content = b"".join(parts)
    if not content:
        raise ApiError(422, "EMPTY_UPLOAD", "The uploaded CSV file is empty.")
    try:
        content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ApiError(415, "INVALID_ENCODING", "Upload a UTF-8 CSV file.") from exc
    if b"\x00" in content:
        raise ApiError(415, "INVALID_FILE_CONTENT", "The upload is not a valid text CSV file.")

    artifact_id = uuid.uuid4().hex
    digest = sha256_hex(content)
    store.write_artifact(case_id, artifact_id, content)
    metadata = {
        "id": artifact_id,
        "modality": "structured",
        "detected_type": "text/csv",
        "label": "structured-input.csv",
        "sha256": digest,
        "size_bytes": size,
        "schema_version": load_manifest()["model_version"],
        "validation_status": "PENDING",
        "validation_result": None,
        "created_at": utc_now(),
    }
    case_record["artifacts"].append(metadata)
    case_record["updated_at"] = utc_now()
    store.save_case(case_record)
    store.append_audit(actor_id, "artifact.upload", artifact_id, "succeeded", request.state.request_id)
    return {"artifact": metadata, "message": "Upload stored privately. Validate it before starting inference."}


@router.post("/cases/{case_id}/validate")
def validate_artifact(case_id: str, payload: ArtifactValidationRequest, request: Request, actor_id: Actor):
    case_record = store.get_owned_case(case_id, actor_id)
    artifact = next((item for item in case_record.get("artifacts", []) if item.get("id") == payload.artifact_id), None)
    if artifact is None:
        raise ApiError(404, "ARTIFACT_NOT_FOUND", "The requested artifact was not found.")

    content = store.read_artifact(case_id, payload.artifact_id)
    if sha256_hex(content) != artifact.get("sha256"):
        result = {"valid": False, "status": "REJECTED", "issues": [{"code": "CHECKSUM_MISMATCH", "message": "The stored artifact checksum did not match its upload record."}]}
    elif len(content) > settings.max_upload_bytes:
        result = {"valid": False, "status": "REJECTED", "issues": [{"code": "UPLOAD_TOO_LARGE", "message": "The stored artifact exceeds the configured size limit."}]}
    else:
        result = validate_csv(content, load_manifest())

    artifact["validation_status"] = result["status"]
    artifact["validation_result"] = result
    artifact["validated_at"] = utc_now()
    case_record["updated_at"] = utc_now()
    store.save_case(case_record)
    store.append_audit(actor_id, "artifact.validate", payload.artifact_id, "succeeded" if result["valid"] else "rejected", request.state.request_id)
    return {"artifact": artifact, "validation": result}
