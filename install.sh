#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="/usr/local/bin/tauon"
SOURCE="$SCRIPT_DIR/tauon.sh"

echo "Installing symlink: $TARGET -> $SOURCE"
sudo ln -sf "$SOURCE" "$TARGET"
sudo chmod +x "$SOURCE"

echo "Done. Now you can run 'tauon' in any directory."