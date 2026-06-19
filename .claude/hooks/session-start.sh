#!/bin/bash
set -euo pipefail

# Only run in remote Claude Code environment
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "=== Hassan's Quotation Tracker — Session Start ==="

# Install Python dependencies
pip install openpyxl pandas --quiet --exists-action i

echo "=== Dependencies ready. Gmail sync will begin automatically. ==="
