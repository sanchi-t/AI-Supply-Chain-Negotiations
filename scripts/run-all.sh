#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi

  if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

cd "$ROOT_DIR"

if [ ! -f ".venv/bin/activate" ]; then
  echo "Missing Python virtualenv. Run ./scripts/setup-all.sh first."
  exit 1
fi

source .venv/bin/activate

./scripts/run-backend.sh &
BACKEND_PID=$!

./scripts/run-web.sh &
FRONTEND_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"
