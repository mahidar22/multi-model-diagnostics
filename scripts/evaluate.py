#!/usr/bin/env python3
"""Evaluate the fixed demonstration rule on an already-separated CSV file."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from apps.api.app.services.evaluation import evaluate_csv


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "csv_path",
        nargs="?",
        default="data/synthetic_demo_evaluation.csv",
        help="CSV with manifest feature columns and a label column (default: synthetic fixture).",
    )
    args = parser.parse_args()
    result = evaluate_csv(Path(args.csv_path).resolve())
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
