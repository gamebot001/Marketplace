#!/bin/zsh
# Run the full test suite.
set -euo pipefail
cd "$(dirname "$0")/.."
source .venv/bin/activate
python -m pytest marketplace_tests/ -q "$@"
