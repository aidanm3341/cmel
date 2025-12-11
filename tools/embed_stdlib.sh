#!/bin/bash
# Generate stdlib_embedded.c from stdlib/*.cmel files
# This script embeds the standard library into the CMEL binary

set -e

OUTPUT="src/stdlib_embedded.c"
HEADER="src/stdlib_embedded.h"

echo "Generating embedded stdlib..."

# Start the C file
cat > "$OUTPUT" << 'EOF'
// AUTO-GENERATED FILE - DO NOT EDIT
// Generated from stdlib/*.cmel files by tools/embed_stdlib.sh
// This file is tracked in git for build convenience

#include "stdlib_embedded.h"

EOF

# Process each .cmel file
declare -a modules=()
module_count=0

for cmel_file in stdlib/*.cmel; do
    if [ -f "$cmel_file" ]; then
        basename=$(basename "$cmel_file" .cmel)
        module_name="stdlib/$basename"
        var_name="STDLIB_$(echo $basename | tr '[:lower:]' '[:upper:]')_SOURCE"

        echo "   Embedding $module_name..."

        echo "static const char ${var_name}[] = " >> "$OUTPUT"

        # Convert file to C string literal
        # Escape backslashes first, then quotes
        while IFS= read -r line || [ -n "$line" ]; do
            # Escape backslashes and quotes
            escaped=$(echo "$line" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g')
            echo "\"$escaped\\n\"" >> "$OUTPUT"
        done < "$cmel_file"

        echo ";" >> "$OUTPUT"
        echo "" >> "$OUTPUT"

        modules+=("$module_name:$var_name")
        module_count=$((module_count + 1))
    fi
done

# Generate the array
echo "const EmbeddedModule EMBEDDED_STDLIB[] = {" >> "$OUTPUT"
for entry in "${modules[@]}"; do
    IFS=':' read -r name var <<< "$entry"
    echo "    {\"$name\", $var, sizeof($var) - 1}," >> "$OUTPUT"
done
echo "};" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "const int EMBEDDED_STDLIB_COUNT = $module_count;" >> "$OUTPUT"

echo "Generated $OUTPUT with $module_count embedded modules"
