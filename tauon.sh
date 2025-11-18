#!/usr/bin/env bash
set -e

# Resolve this script's real path (follows symlinks)
SCRIPT_PATH="$(readlink -f "$0")"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"

APP_PATH="$SCRIPT_DIR/app.py"

# Use the current working directory as BASE_DIR
BASE_DIR="$PWD" python3 "$APP_PATH" "$@"