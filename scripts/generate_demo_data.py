#!/usr/bin/env python3
"""Write one safe, synthetic row matching the active task manifest."""

from pathlib import Path

from apps.api.app.core.config import PROJECT_ROOT
from ml.inference import load_manifest


def main() -> None:
    manifest = load_manifest()
    features = manifest["features"]
    header = ",".join(item["name"] for item in features)
    midpoint_values = ",".join(str((float(item["minimum"]) + float(item["maximum"])) / 2) for item in features)
    output = PROJECT_ROOT / "data" / "sample_case.csv"
    output.write_text(f"{header}\n{midpoint_values}\n", encoding="utf-8")
    print(f"Wrote synthetic sample to {output.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
