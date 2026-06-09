#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT_DIR"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
python3 -m pip install --upgrade pip
pip install -r backend/requirements.txt
npm install

echo
echo "Setup complete."
echo "Backend virtualenv: $ROOT_DIR/.venv"
echo "Frontend dependencies: installed"
