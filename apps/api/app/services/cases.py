from __future__ import annotations

import re

from apps.api.app.core.errors import ApiError
from apps.api.app.schemas.contracts import CaseCreate
from apps.api.app.storage.local import LocalFileStore, new_id, store, utc_now
from ml.inference import load_manifest

_REFERENCE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{1,63}$")


def create_case(payload: CaseCreate, actor_id: str, request_id: str, file_store: LocalFileStore = store) -> dict:
    case_id = new_id()
    reference = payload.pseudonymous_reference or f"CASE-{case_id[:8].upper()}"
    if not _REFERENCE_RE.fullmatch(reference):
        raise ApiError(422, "INVALID_REFERENCE", "Use a short pseudonymous reference with letters, numbers, dots, underscores, or hyphens only.")
    timestamp = utc_now()
    manifest = load_manifest()
    record = {
        "id": case_id,
        "task_id": manifest["task_id"],
        "task_version": manifest["task_version"],
        "owner_id": actor_id,
        "pseudonymous_reference": reference,
        "status": "ACTIVE",
        "created_at": timestamp,
        "updated_at": timestamp,
        "artifacts": [],
        "run_ids": [],
    }
    file_store.create_case(record)
    file_store.append_audit(actor_id, "case.create", case_id, "succeeded", request_id)
    return record


def list_cases(actor_id: str, file_store: LocalFileStore = store) -> list[dict]:
    return file_store.list_cases(actor_id)


def get_case(case_id: str, actor_id: str, file_store: LocalFileStore = store) -> dict:
    return file_store.get_owned_case(case_id, actor_id)
