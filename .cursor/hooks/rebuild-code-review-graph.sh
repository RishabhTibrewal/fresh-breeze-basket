#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GRAPH_DB="$ROOT_DIR/.code-review-graph/graph.db"
STAMP_FILE="$ROOT_DIR/.cursor/hooks/.crg-last-run"
LOG_FILE="$ROOT_DIR/.cursor/hooks/code-review-graph.log"

# Debounce frequent edits (seconds)
MIN_INTERVAL=300
# "Major change" threshold by changed files count
MAJOR_FILE_THRESHOLD=8

now_epoch="$(date +%s)"
last_epoch="0"
if [[ -f "$STAMP_FILE" ]]; then
  last_epoch="$(cat "$STAMP_FILE" 2>/dev/null || echo "0")"
fi

if (( now_epoch - last_epoch < MIN_INTERVAL )); then
  exit 0
fi

if ! command -v git >/dev/null 2>&1; then
  exit 0
fi

if ! git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

changed_files="$(git -C "$ROOT_DIR" status --porcelain | wc -l | tr -d ' ')"
if [[ -z "$changed_files" ]]; then
  changed_files=0
fi

if (( changed_files < MAJOR_FILE_THRESHOLD )); then
  exit 0
fi

mkdir -p "$(dirname "$LOG_FILE")"

{
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] major change detected (${changed_files} files). Rebuilding code-review-graph..."

  if command -v code-review-graph >/dev/null 2>&1; then
    code-review-graph build
  elif command -v npx >/dev/null 2>&1; then
    npx code-review-graph build
  else
    echo "code-review-graph command not found; skipping rebuild."
    exit 0
  fi

  echo "$now_epoch" > "$STAMP_FILE"
  if [[ -f "$GRAPH_DB" ]]; then
    echo "code-review-graph rebuild complete: $GRAPH_DB"
  else
    echo "build command finished but graph.db not found at expected path."
  fi
} >> "$LOG_FILE" 2>&1

exit 0
