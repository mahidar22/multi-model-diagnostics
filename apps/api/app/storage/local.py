from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from apps.api.app.core.config import settings
from apps.api.app.core.errors import ApiError

_ID_RE = re.compile(r"^[0-9a-f]{32}$")
_WRITE_LOCK = threading.RLock()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def new_id() -> str:
    return uuid.uuid4().hex


class LocalFileStore:
    """Private, single-process JSON + file storage for a local research demo.

    This intentionally is not a database or production object store. All paths are
    generated from random IDs; user-provided filenames are never used as paths.
    """

    def __init__(self, root: Path | None = None):
        self.root = (root or settings.private_data_root).resolve()
        self.cases_root = self.root / "cases"
        self.audit_root = self.root / "audit"
        self.audit_path = self.audit_root / "events.jsonl"
        self.initialize()

    def initialize(self) -> None:
        for path in (self.root, self.cases_root, self.audit_root):
            path.mkdir(parents=True, exist_ok=True, mode=0o700)
            try:
                os.chmod(path, 0o700)
            except OSError:
                pass

    @staticmethod
    def _check_id(value: str) -> str:
        if not isinstance(value, str) or not _ID_RE.fullmatch(value):
            raise ApiError(404, "RESOURCE_NOT_FOUND", "The requested resource was not found.")
        return value

    def _case_dir(self, case_id: str) -> Path:
        return self.cases_root / self._check_id(case_id)

    @staticmethod
    def _atomic_json(path: Path, value: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        fd, temporary_name = tempfile.mkstemp(prefix=".write-", suffix=".tmp", dir=path.parent)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(value, handle, ensure_ascii=False, indent=2, allow_nan=False)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary_name, path)
        finally:
            if os.path.exists(temporary_name):
                os.unlink(temporary_name)

    def create_case(self, case_record: dict[str, Any]) -> None:
        case_id = self._check_id(case_record["id"])
        case_dir = self._case_dir(case_id)
        with _WRITE_LOCK:
            if case_dir.exists():
                raise ApiError(409, "CASE_ALREADY_EXISTS", "A case with this identifier already exists.")
            (case_dir / "artifacts").mkdir(parents=True, mode=0o700)
            (case_dir / "runs").mkdir(parents=True, mode=0o700)
            self._atomic_json(case_dir / "case.json", case_record)

    def get_case(self, case_id: str) -> dict[str, Any]:
        path = self._case_dir(case_id) / "case.json"
        if not path.is_file():
            raise ApiError(404, "CASE_NOT_FOUND", "The requested case was not found.")
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ApiError(500, "STORAGE_READ_FAILED", "Case metadata could not be read.") from exc

    def save_case(self, case_record: dict[str, Any]) -> None:
        path = self._case_dir(case_record["id"]) / "case.json"
        if not path.parent.is_dir():
            raise ApiError(404, "CASE_NOT_FOUND", "The requested case was not found.")
        with _WRITE_LOCK:
            self._atomic_json(path, case_record)

    def list_cases(self, actor_id: str) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for path in self.cases_root.glob("*/case.json"):
            try:
                record = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if record.get("owner_id") == actor_id:
                items.append(record)
        return sorted(items, key=lambda item: item.get("created_at", ""), reverse=True)

    def get_owned_case(self, case_id: str, actor_id: str) -> dict[str, Any]:
        record = self.get_case(case_id)
        if record.get("owner_id") != actor_id:
            # Do not reveal whether a different user's case exists.
            raise ApiError(404, "CASE_NOT_FOUND", "The requested case was not found.")
        return record

    def write_artifact(self, case_id: str, artifact_id: str, content: bytes) -> Path:
        artifact_id = self._check_id(artifact_id)
        directory = self._case_dir(case_id) / "artifacts"
        if not directory.is_dir():
            raise ApiError(404, "CASE_NOT_FOUND", "The requested case was not found.")
        path = directory / f"{artifact_id}.csv"
        with _WRITE_LOCK:
            temporary = path.with_suffix(".upload.tmp")
            temporary.write_bytes(content)
            try:
                os.chmod(temporary, 0o600)
            except OSError:
                pass
            os.replace(temporary, path)
        return path

    def read_artifact(self, case_id: str, artifact_id: str) -> bytes:
        artifact_id = self._check_id(artifact_id)
        path = self._case_dir(case_id) / "artifacts" / f"{artifact_id}.csv"
        if not path.is_file():
            raise ApiError(404, "ARTIFACT_NOT_FOUND", "The requested artifact was not found.")
        try:
            return path.read_bytes()
        except OSError as exc:
            raise ApiError(500, "STORAGE_READ_FAILED", "The artifact could not be read.") from exc

    def save_run(self, case_id: str, run_record: dict[str, Any]) -> None:
        run_id = self._check_id(run_record["id"])
        path = self._case_dir(case_id) / "runs" / f"{run_id}.json"
        with _WRITE_LOCK:
            self._atomic_json(path, run_record)

    def get_run(self, case_id: str, run_id: str) -> dict[str, Any]:
        run_id = self._check_id(run_id)
        path = self._case_dir(case_id) / "runs" / f"{run_id}.json"
        if not path.is_file():
            raise ApiError(404, "RUN_NOT_FOUND", "The requested run was not found.")
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ApiError(500, "STORAGE_READ_FAILED", "Run metadata could not be read.") from exc

    def find_owned_run(self, run_id: str, actor_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
        run_id = self._check_id(run_id)
        # Runs are stored below their owning case. Search only metadata, never file contents.
        for case_record in self.list_cases(actor_id):
            if run_id in case_record.get("run_ids", []):
                return case_record, self.get_run(case_record["id"], run_id)
        raise ApiError(404, "RUN_NOT_FOUND", "The requested run was not found.")

    def delete_case(self, case_id: str, actor_id: str, request_id: str) -> None:
        case_record = self.get_owned_case(case_id, actor_id)
        case_dir = self._case_dir(case_id)
        try:
            with _WRITE_LOCK:
                shutil.rmtree(case_dir)
        except OSError as exc:
            self.append_audit(actor_id, "case.delete", case_record["id"], "failed", request_id)
            raise ApiError(500, "CASE_DELETE_FAILED", "The case could not be fully removed from local storage.") from exc
        # Retain only a minimal event; no input values or filenames are logged.
        self.append_audit(actor_id, "case.delete", case_record["id"], "succeeded", request_id)

    def export_case_files(self, case_id: str, actor_id: str) -> tuple[dict[str, Any], list[tuple[str, bytes]]]:
        case_record = self.get_owned_case(case_id, actor_id)
        files: list[tuple[str, bytes]] = []
        for artifact in case_record.get("artifacts", []):
            artifact_id = artifact.get("id", "")
            if _ID_RE.fullmatch(artifact_id):
                try:
                    files.append((f"artifacts/{artifact_id}.csv", self.read_artifact(case_id, artifact_id)))
                except ApiError:
                    continue
        for run_id in case_record.get("run_ids", []):
            try:
                run = self.get_run(case_id, run_id)
            except ApiError:
                continue
            files.append((f"runs/{run_id}.json", json.dumps(run, indent=2, ensure_ascii=False).encode("utf-8")))
        return case_record, files

    def append_audit(self, actor_id: str, action: str, object_id: str, outcome: str, request_id: str) -> None:
        event = {
            "actor_id": actor_id,
            "action": action,
            "object_id": object_id,
            "occurred_at": utc_now(),
            "outcome": outcome,
            "request_id": request_id,
        }
        self.audit_root.mkdir(parents=True, exist_ok=True, mode=0o700)
        with _WRITE_LOCK:
            with self.audit_path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(event, ensure_ascii=False, separators=(",", ":")) + "\n")
            try:
                os.chmod(self.audit_path, 0o600)
            except OSError:
                pass


store = LocalFileStore()
