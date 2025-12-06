#!/bin/bash
# Install script for Cmel interpreter

set -e

echo "🔨 Building and installing Cmel interpreter..."

# Navigate to the cmel directory
cd "$(dirname "$0")"

# Build the interpreter
echo "📦 Compiling Cmel..."
./build.sh

# Determine installation directory
INSTALL_DIR="/usr/local/bin"

# Check if we have write permissions
if [ -w "$INSTALL_DIR" ]; then
    SUDO=""
else
    SUDO="sudo"
    echo "⚠️  Need sudo permissions to install to $INSTALL_DIR"
fi

# Install the binary
echo "📥 Installing cmel to $INSTALL_DIR..."
$SUDO cp cmel "$INSTALL_DIR/cmel"
$SUDO chmod +x "$INSTALL_DIR/cmel"

# Verify installation
if command -v cmel &> /dev/null; then
    echo "✅ Cmel installed successfully!"
    echo "📍 Location: $(which cmel)"
    echo "🎉 You can now run 'cmel' from anywhere!"
    echo ""
    echo "Try it out:"
    echo "  cmel              # Start REPL"
    echo "  cmel <file.cmel>  # Run a Cmel file"
else
    echo "❌ Installation failed. Please check permissions."
    exit 1
fi
