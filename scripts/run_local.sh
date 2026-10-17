#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example. Change the demo token before any shared deployment."
fi

python -m uvicorn apps.api.app.main:app --host 0.0.0.0 --port 8000 &
API_PID=$!
(
  cd apps/web
  npm run dev -- --host 0.0.0.0
) &
WEB_PID=$!
cleanup() {
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
wait "$WEB_PID"
