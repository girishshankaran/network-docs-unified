#!/bin/sh
set -eu

EXTENSION_ID="network-docs.network-docs-topic-variant-0.0.1"
SOURCE_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
TARGET_ROOT="${VSCODE_EXTENSIONS_DIR:-$HOME/.vscode/extensions}"
TARGET_DIR="$TARGET_ROOT/$EXTENSION_ID"

mkdir -p "$TARGET_DIR"

cp "$SOURCE_DIR/package.json" "$TARGET_DIR/package.json"
cp "$SOURCE_DIR/extension.js" "$TARGET_DIR/extension.js"
cp "$SOURCE_DIR/README.md" "$TARGET_DIR/README.md"

echo "Installed $EXTENSION_ID to $TARGET_DIR"
echo "Restart VS Code or run Developer: Reload Window."
