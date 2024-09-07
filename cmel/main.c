#include "common.h"
#include "chunk.h"
#include "debug.h"

int main(int argc, const char* argv[]) {
    Chunk chunk;
    initChunk(&chunk);

    for (int i = 0; i < 258; i++) {
        writeConstant(&chunk, 12.5, 123);
    }

    writeChunk(&chunk, OP_RETURN, 123);

    disassembleChunk(&chunk, "test chunk");
    freeChunk(&chunk);
    return 0;
}