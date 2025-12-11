#ifndef cmel_stdlib_embedded_h
#define cmel_stdlib_embedded_h

#include <stddef.h>

typedef struct {
    const char* name;        // Module name (e.g., "stdlib/math")
    const char* source;      // Embedded .cmel source code
    size_t length;           // Source length for optimization
} EmbeddedModule;

extern const EmbeddedModule EMBEDDED_STDLIB[];
extern const int EMBEDDED_STDLIB_COUNT;

#endif
