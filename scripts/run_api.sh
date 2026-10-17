#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
python -m uvicorn apps.api.app.main:app --host 0.0.0.0 --port 8000
