from __future__ import annotations

import csv
import math
from pathlib import Path

from apps.api.app.core.config import PROJECT_ROOT
from ml.evaluation.metrics import classification_metrics
from ml.inference import load_manifest, predict


def evaluate_csv(path: Path) -> dict:
    manifest = load_manifest()
    labels = manifest["class_labels"]
    feature_names = [item["name"] for item in manifest["features"]]
    y_true: list[str] = []
    y_pred: list[str] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, strict=True)
        expected_headers = set(feature_names + ["label"])
        if not reader.fieldnames or set(reader.fieldnames) != expected_headers or len(reader.fieldnames) != len(expected_headers):
            raise ValueError("Evaluation CSV columns must contain the manifest features plus label.")
        for row in reader:
            if None in row or any(row.get(name) is None for name in expected_headers):
                raise ValueError("Evaluation CSV contains a malformed row.")
            label = (row.get("label") or "").strip()
            if label not in labels:
                raise ValueError("Evaluation CSV contains a label not declared in the manifest.")
            values = {}
            for spec in manifest["features"]:
                name = spec["name"]
                try:
                    value = float(row[name])
                except (TypeError, ValueError) as exc:
                    raise ValueError(f"Evaluation feature {name} must be numeric.") from exc
                if not math.isfinite(value) or not float(spec["minimum"]) <= value <= float(spec["maximum"]):
                    raise ValueError(f"Evaluation feature {name} is outside the manifest's finite range.")
                values[name] = value
            y_true.append(label)
            y_pred.append(predict(values, manifest, include_explanation=False)["label"])
    if not y_true:
        raise ValueError("Evaluation CSV must contain at least one data row.")
    result = classification_metrics(y_true, y_pred, labels)
    is_fixture = path.resolve() == (PROJECT_ROOT / "data/synthetic_demo_evaluation.csv").resolve()
    result["fixture"] = is_fixture
    if is_fixture:
        result["warnings"] = [
            "Synthetic fixture only; these metrics are not evidence of clinical performance.",
            "The 12-row fixture includes one deliberately inconsistent synthetic label to exercise error metrics.",
        ]
    else:
        result["warnings"] = [
            "This command assumes the input is an already-separated evaluation set; it does not create a split or detect leakage.",
            "Metrics are not evidence of clinical performance and require dataset/task-specific review.",
        ]
    return result


def evaluate_demo_fixture() -> dict:
    return evaluate_csv(PROJECT_ROOT / "data/synthetic_demo_evaluation.csv")
