from __future__ import annotations

import csv
import hashlib
import io
import math
from typing import Any

from apps.api.app.core.errors import ApiError
from ml.inference import load_manifest


def sha256_hex(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def validate_csv(content: bytes, manifest: dict[str, Any] | None = None) -> dict[str, Any]:
    manifest = manifest or load_manifest()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        return {"valid": False, "status": "REJECTED", "issues": [{"code": "INVALID_ENCODING", "message": "Upload a UTF-8 CSV file."}]}

    if not text.strip() or "\x00" in text:
        return {"valid": False, "status": "REJECTED", "issues": [{"code": "EMPTY_OR_INVALID_FILE", "message": "The CSV file is empty or contains invalid binary data."}]}

    try:
        reader = csv.DictReader(io.StringIO(text, newline=""), strict=True)
        headers = reader.fieldnames
        if not headers:
            raise ValueError("missing header")
        required = [feature["name"] for feature in manifest["features"]]
        if len(headers) != len(set(headers)) or set(headers) != set(required):
            return {
                "valid": False,
                "status": "REJECTED",
                "issues": [{
                    "code": "SCHEMA_MISMATCH",
                    "message": f"CSV columns must be exactly: {', '.join(required)}.",
                }],
            }

        rows = []
        for row in reader:
            if None in row:
                return {"valid": False, "status": "REJECTED", "issues": [{"code": "SCHEMA_MISMATCH", "message": "A data row contains too many columns."}]}
            rows.append(row)
            if len(rows) > 1:
                return {
                    "valid": False,
                    "status": "REJECTED",
                    "issues": [{"code": "ROW_LIMIT_EXCEEDED", "message": "This single-case demo accepts exactly one data row."}],
                }
        if len(rows) != 1:
            return {
                "valid": False,
                "status": "REJECTED",
                "issues": [{"code": "ROW_COUNT_INVALID", "message": "This single-case demo requires exactly one data row."}],
            }

        row = rows[0]
        parsed: dict[str, float] = {}
        for feature in manifest["features"]:
            name = feature["name"]
            raw_value = row.get(name)
            if raw_value is None or not raw_value.strip():
                return {"valid": False, "status": "REJECTED", "issues": [{"code": "MISSING_VALUE", "message": f"A value is required for {name}."}]}
            try:
                value = float(raw_value)
            except (TypeError, ValueError):
                return {"valid": False, "status": "REJECTED", "issues": [{"code": "INVALID_NUMBER", "message": f"{name} must be numeric."}]}
            if not math.isfinite(value):
                return {"valid": False, "status": "REJECTED", "issues": [{"code": "NON_FINITE_VALUE", "message": f"{name} must be a finite number."}]}
            if value < float(feature["minimum"]) or value > float(feature["maximum"]):
                return {
                    "valid": False,
                    "status": "REJECTED",
                    "issues": [{"code": "VALUE_OUT_OF_RANGE", "message": f"{name} must be between {feature['minimum']} and {feature['maximum']} (inclusive)."}],
                }
            parsed[name] = value
    except (csv.Error, ValueError):
        return {"valid": False, "status": "REJECTED", "issues": [{"code": "MALFORMED_CSV", "message": "The CSV file could not be parsed."}]}

    return {
        "valid": True,
        "status": "VALID",
        "row_count": 1,
        "feature_count": len(parsed),
        "issues": [],
    }


def parse_validated_features(content: bytes, manifest: dict[str, Any] | None = None) -> dict[str, float]:
    manifest = manifest or load_manifest()
    validation = validate_csv(content, manifest)
    if not validation["valid"]:
        raise ApiError(422, "ARTIFACT_INVALID", validation["issues"][0]["message"])
    text = content.decode("utf-8-sig")
    row = next(csv.DictReader(io.StringIO(text, newline="")))
    return {feature["name"]: float(row[feature["name"]]) for feature in manifest["features"]}
