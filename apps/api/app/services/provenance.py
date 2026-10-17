from __future__ import annotations

import hashlib
import os
from pathlib import Path

from apps.api.app.core.config import PROJECT_ROOT, settings
from ml.inference import load_manifest


def _sha256_file(path: Path) -> str | None:
    try:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for block in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(block)
        return digest.hexdigest()
    except OSError:
        return None


def build_provenance() -> dict:
    manifest = load_manifest()
    evaluation_path = PROJECT_ROOT / "data/synthetic_demo_evaluation.csv"
    try:
        manifest_path = settings.manifest_path.resolve().relative_to(PROJECT_ROOT.resolve()).as_posix()
    except ValueError:
        manifest_path = str(settings.manifest_path.resolve())
    return {
        "task_manifest": manifest_path,
        "task_manifest_sha256": _sha256_file(settings.manifest_path),
        "model_checksum": "fixed-demonstration-rule-defined-by-manifest",
        "evaluation_fixture": "data/synthetic_demo_evaluation.csv",
        "evaluation_fixture_sha256": _sha256_file(evaluation_path),
        "code_revision": os.getenv("CODE_REVISION", "working-tree-unversioned"),
        "label_order": manifest["class_labels"],
        "preprocessing_version": manifest["preprocessing"]["version"],
        "random_seed": None,
    }
