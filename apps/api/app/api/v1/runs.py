from __future__ import annotations

import time
from typing import Annotated

from fastapi import APIRouter, Depends, Request

from apps.api.app.core.errors import ApiError
from apps.api.app.core.security import get_current_actor
from apps.api.app.schemas.contracts import ReportCreate, RunCreate
from apps.api.app.services.artifacts import parse_validated_features, sha256_hex
from apps.api.app.services.provenance import build_provenance
from apps.api.app.services.reports import create_report
from apps.api.app.storage.local import new_id, store, utc_now
from ml.inference import build_explanation, load_manifest, predict

router = APIRouter(tags=["runs"])
Actor = Annotated[str, Depends(get_current_actor)]


@router.post("/cases/{case_id}/runs")
def start_run(case_id: str, payload: RunCreate, request: Request, actor_id: Actor):
    case_record = store.get_owned_case(case_id, actor_id)
    manifest = load_manifest()
    if case_record.get("task_id") != manifest["task_id"] or case_record.get("task_version") != manifest["task_version"]:
        raise ApiError(409, "TASK_VERSION_MISMATCH", "This case was created for a different task manifest.")
    if payload.model_version != manifest["model_version"]:
        raise ApiError(422, "MODEL_VERSION_UNAVAILABLE", "The requested model version is not available in this prototype.")
    if "prediction" not in payload.requested_outputs:
        raise ApiError(422, "PREDICTION_REQUIRED", "Prediction must be included in requested_outputs.")
    if len(set(payload.requested_outputs)) != len(payload.requested_outputs):
        raise ApiError(422, "DUPLICATE_OUTPUT", "requested_outputs must not contain duplicates.")

    artifact = next((item for item in case_record.get("artifacts", []) if item.get("id") == payload.artifact_id), None)
    if artifact is None:
        raise ApiError(404, "ARTIFACT_NOT_FOUND", "The requested artifact was not found.")
    if artifact.get("schema_version") != manifest["model_version"]:
        raise ApiError(409, "ARTIFACT_SCHEMA_VERSION_MISMATCH", "The artifact was validated against a different task/model manifest.")
    if artifact.get("validation_status") != "VALID":
        raise ApiError(409, "ARTIFACT_NOT_VALIDATED", "Validate the uploaded artifact successfully before running inference.")

    content = store.read_artifact(case_id, payload.artifact_id)
    if sha256_hex(content) != artifact.get("sha256"):
        raise ApiError(422, "CHECKSUM_MISMATCH", "The stored artifact checksum did not match its validation record.")
    features = parse_validated_features(content, manifest)
    started = time.perf_counter()
    try:
        raw_result = predict(features, manifest, include_explanation=False)
        prediction = {key: raw_result[key] for key in ("label", "scores", "score_type", "model_version", "task_id", "decision_threshold")}
    except Exception as exc:
        # Do not expose exception text, feature values, or local paths in the API response.
        raise ApiError(500, "INFERENCE_FAILED", "The configured demonstration inference could not be completed.") from exc

    status = "SUCCEEDED"
    warnings = [
        "Synthetic demonstration only: this output is not a diagnosis, risk assessment, or treatment recommendation.",
        "Scores are illustrative and uncalibrated; no clinical dataset or clinical model is included.",
        "Only structured input was configured for this task. Image, signal, and text modalities were not processed.",
    ]
    explanation = None
    if "explanation" in payload.requested_outputs:
        try:
            explanation = build_explanation(features, raw_result["label"], raw_result["_positive_class_logit"], manifest)
        except Exception:
            # Do not discard a successful prediction if an optional XAI method is unavailable.
            status = "PARTIAL"
            warnings.append("Prediction succeeded, but the requested explanation could not be generated.")

    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
    run_id = new_id()
    run_record = {
        "id": run_id,
        "case_id": case_id,
        "task_id": manifest["task_id"],
        "model_version": manifest["model_version"],
        "preprocessing_version": manifest["preprocessing"]["version"],
        "status": status,
        "created_at": utc_now(),
        "completed_at": utc_now(),
        "processing_ms": elapsed_ms,
        "input_artifact_ids": [payload.artifact_id],
        "input_checksums": {payload.artifact_id: artifact["sha256"]},
        "present_modalities": ["structured"],
        "unconfigured_modalities": ["image", "signal", "text"],
        "modality_status": {
            "structured": "present",
            "image": "not_configured_for_task",
            "signal": "not_configured_for_task",
            "text": "not_configured_for_task",
        },
        "prediction": prediction,
        "explanation": explanation,
        "reports": [],
        "warnings": warnings,
        "provenance": build_provenance(),
    }
    store.save_run(case_id, run_record)
    case_record["run_ids"].append(run_id)
    case_record["updated_at"] = utc_now()
    store.save_case(case_record)
    store.append_audit(actor_id, "run.inference", run_id, "succeeded", request.state.request_id)
    return {"run_id": run_id, "status": status, "run": run_record}


@router.get("/runs/{run_id}")
def read_run(run_id: str, actor_id: Actor):
    _case, run_record = store.find_owned_run(run_id, actor_id)
    return run_record


@router.get("/runs/{run_id}/explanations")
def read_explanations(run_id: str, actor_id: Actor):
    _case, run_record = store.find_owned_run(run_id, actor_id)
    explanation = run_record.get("explanation")
    return {"items": [explanation] if explanation else []}


@router.post("/runs/{run_id}/report")
def create_run_report(run_id: str, payload: ReportCreate, request: Request, actor_id: Actor):
    _case, run_record = store.find_owned_run(run_id, actor_id)
    try:
        report = create_report(payload.question)
    except Exception:
        # A report failure must not erase or replace the successful prediction.
        report = {
            "status": "FAILED",
            "text": "Evidence retrieval could not be completed. The prediction remains available for human review.",
            "citations": [],
            "generator": "none",
            "retrieval_version": "lexical-overlap-v1",
            "warnings": ["No report claims or citations were returned after a retrieval failure."],
        }
    report["id"] = new_id()
    report["created_at"] = utc_now()
    # Do not persist free-text queries; they may contain sensitive information.
    run_record.setdefault("reports", []).append(report)
    if report["status"] in {"ABSTAINED", "FAILED"}:
        run_record["status"] = "PARTIAL"
        run_record.setdefault("warnings", []).append("Prediction succeeded, but the requested evidence report abstained or failed; prediction output remains available.")
    store.save_run(run_record["case_id"], run_record)
    store.append_audit(actor_id, "report.create", report["id"], report["status"].lower(), request.state.request_id)
    return report
