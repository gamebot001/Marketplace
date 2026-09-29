#!/bin/zsh
# Create the Python virtualenv and install backend requirements.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r marketplace_backend/requirements.txt
python marketplace-scripts/check_environment.py
