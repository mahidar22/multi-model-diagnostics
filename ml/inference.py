from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any

from apps.api.app.core.config import settings


@lru_cache(maxsize=4)
def load_manifest(manifest_path: str | None = None) -> dict[str, Any]:
    path = Path(manifest_path) if manifest_path else settings.manifest_path
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError("The configured task/model manifest could not be loaded.") from exc

    required = {"task_id", "task_name", "task_version", "model_version", "input_modality", "accepted_modalities", "class_labels", "features", "bias", "positive_class", "decision_threshold", "score_type", "preprocessing", "explainability"}
    if not isinstance(manifest, dict) or not required.issubset(manifest):
        raise RuntimeError("The task/model manifest is missing required fields.")
    if manifest["input_modality"] != "structured" or not isinstance(manifest["accepted_modalities"], list) or "structured" not in manifest["accepted_modalities"]:
        raise RuntimeError("This first-release runner only supports a configured structured modality.")
    if not isinstance(manifest["task_id"], str) or not isinstance(manifest["model_version"], str) or not manifest["task_id"] or not manifest["model_version"]:
        raise RuntimeError("Task and model identifiers must be non-empty strings.")
    labels = manifest["class_labels"]
    features = manifest["features"]
    if not isinstance(labels, list) or len(labels) != 2 or not all(isinstance(label, str) and label for label in labels) or len(set(labels)) != 2:
        raise RuntimeError("The demo manifest must define two unique non-empty class labels.")
    if not isinstance(features, list) or not features:
        raise RuntimeError("The demo manifest must define at least one feature.")
    names = []
    for feature in features:
        if not isinstance(feature, dict) or not {"name", "minimum", "maximum", "weight"}.issubset(feature):
            raise RuntimeError("Each manifest feature must declare a name, range, and weight.")
        name = feature["name"]
        if not isinstance(name, str) or not name:
            raise RuntimeError("Manifest feature names must be non-empty strings.")
        if feature.get("type") != "float" or not isinstance(feature.get("label"), str):
            raise RuntimeError("This structured demo expects labelled float features.")
        names.append(name)
        try:
            minimum, maximum, weight = float(feature["minimum"]), float(feature["maximum"]), float(feature["weight"])
        except (TypeError, ValueError) as exc:
            raise RuntimeError("Manifest feature bounds and weights must be numeric.") from exc
        if not all(math.isfinite(value) for value in (minimum, maximum, weight)) or minimum > maximum:
            raise RuntimeError("Manifest feature bounds and weights must be finite and ordered.")
    if len(set(names)) != len(names):
        raise RuntimeError("The demo manifest feature names must be unique.")
    if manifest["positive_class"] not in labels:
        raise RuntimeError("The manifest positive class must be listed in class_labels.")
    try:
        bias = float(manifest["bias"])
        threshold = float(manifest["decision_threshold"])
    except (TypeError, ValueError) as exc:
        raise RuntimeError("Manifest bias and decision threshold must be numeric.") from exc
    if not math.isfinite(bias) or not math.isfinite(threshold) or not 0.0 <= threshold <= 1.0:
        raise RuntimeError("Manifest bias must be finite and threshold must be between 0 and 1.")
    if not isinstance(manifest["preprocessing"], dict) or not manifest["preprocessing"].get("version"):
        raise RuntimeError("The manifest must declare a versioned preprocessing configuration.")
    if not isinstance(manifest["explainability"], dict) or not manifest["explainability"].get("method"):
        raise RuntimeError("The manifest must declare an explanation method.")
    return manifest


def _score(features: dict[str, float], manifest: dict[str, Any]) -> dict[str, Any]:
    logit = float(manifest["bias"])
    for feature in manifest["features"]:
        name = feature["name"]
        if name not in features:
            raise ValueError("A required feature is missing.")
        value = float(features[name])
        if not math.isfinite(value):
            raise ValueError("A required feature is not finite.")
        logit += float(feature["weight"]) * value

    # Numerically stable logistic transform.
    if logit >= 0:
        positive_score = 1.0 / (1.0 + math.exp(-min(logit, 700.0)))
    else:
        exp_logit = math.exp(max(logit, -700.0))
        positive_score = exp_logit / (1.0 + exp_logit)

    positive_class = manifest["positive_class"]
    negative_class = next(label for label in manifest["class_labels"] if label != positive_class)
    threshold = float(manifest["decision_threshold"])
    predicted_label = positive_class if positive_score >= threshold else negative_class
    score_by_label = {positive_class: positive_score, negative_class: 1.0 - positive_score}

    return {
        "label": predicted_label,
        "scores": [
            {"label": label, "score": round(score_by_label[label], 6)}
            for label in manifest["class_labels"]
        ],
        "score_type": manifest["score_type"],
        "model_version": manifest["model_version"],
        "task_id": manifest["task_id"],
        "decision_threshold": threshold,
        "_positive_class_logit": logit,
    }


def build_explanation(features: dict[str, float], predicted_label: str, logit: float, manifest: dict[str, Any]) -> dict[str, Any]:
    explainability = manifest["explainability"]
    if not explainability.get("supported", False):
        raise ValueError("This model version does not support an explanation method.")
    contributions = []
    for feature in manifest["features"]:
        name = feature["name"]
        value = float(features[name])
        contributions.append({
            "feature": name,
            "label": feature.get("label", name),
            "value": value,
            "contribution_to_positive_class_logit": round(float(feature["weight"]) * value, 6),
        })
    return {
        "method": explainability["method"],
        "target_class": predicted_label,
        "positive_class": manifest["positive_class"],
        "positive_class_logit": round(logit, 6),
        "bias_contribution": float(manifest["bias"]),
        "feature_contributions": contributions,
        "limitations": explainability["limitations"],
    }


def predict(features: dict[str, float], manifest: dict[str, Any] | None = None, include_explanation: bool = True) -> dict[str, Any]:
    manifest = manifest or load_manifest()
    result = _score(features, manifest)
    explanation = None
    if include_explanation:
        try:
            explanation = build_explanation(features, result["label"], result["_positive_class_logit"], manifest)
        except Exception:
            # The prediction is an independent output; explanation failure is represented separately.
            explanation = None
    result["explanation"] = explanation
    return result
