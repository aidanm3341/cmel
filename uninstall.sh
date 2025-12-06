#!/bin/bash
# Uninstall script for Cmel interpreter

set -e

echo "🗑️  Uninstalling Cmel interpreter..."

INSTALL_DIR="/usr/local/bin"
BINARY_PATH="$INSTALL_DIR/cmel"

# Check if cmel is installed
if [ ! -f "$BINARY_PATH" ]; then
    echo "❌ Cmel is not installed at $BINARY_PATH"
    exit 1
fi

# Check if we have write permissions
if [ -w "$INSTALL_DIR" ]; then
    SUDO=""
else
    SUDO="sudo"
    echo "⚠️  Need sudo permissions to uninstall from $INSTALL_DIR"
fi

# Remove the binary
$SUDO rm "$BINARY_PATH"

echo "✅ Cmel uninstalled successfully!"
