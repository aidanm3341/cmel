#!/bin/bash
# Build the CMEL interpreter

set -e  # Exit on error

# Generate embedded stdlib
if [ -f tools/embed_stdlib.sh ]; then
    ./tools/embed_stdlib.sh
fi

# Compile all C files
gcc src/*.c -o cmel

echo "Build complete: ./cmel"