#!/bin/bash

set -e

echo "📦 Building and installing Cmel language extension..."

# Navigate to the extension directory
cd "$(dirname "$0")"

# Compile TypeScript
echo "🔨 Compiling TypeScript..."
npm run compile

# Package the extension
echo "📦 Packaging extension..."
npm run package

# Install the extension
echo "🚀 Installing extension in VS Code..."
code --install-extension cmel-language-0.0.1.vsix --force

echo "✅ Extension installed successfully!"
echo "💡 Reload VS Code to activate the extension"
