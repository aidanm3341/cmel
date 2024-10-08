#include <stdlib.h>

#include "chunk.h"
#include "memory.h"
#include "vm.h"

void initChunk(Chunk* chunk) {
    chunk->capacity = 0;
    chunk->count = 0;
    chunk->code = NULL;
    chunk->lines = NULL;
    initValueArray(&chunk->constants);
}

void freeChunk(Chunk* chunk) {
    FREE_ARRAY(uint8_t, chunk->code, chunk->capacity);
    FREE_ARRAY(int, chunk->lines, chunk->capacity);
    freeValueArray(&chunk->constants);
    initChunk(chunk);
}

void writeChunk(Chunk* chunk, uint8_t byte, int line) {
    if (chunk->capacity < chunk->count + 1) {
        int oldCapacity = chunk->capacity;
        chunk->capacity = GROW_CAPACITY(oldCapacity);
        chunk->code = GROW_ARRAY(uint8_t, chunk->code, oldCapacity, chunk->capacity);
        chunk->lines = GROW_ARRAY(int, chunk->lines, oldCapacity, chunk->capacity);
    }

    chunk->code[chunk->count] = byte;
    chunk->lines[chunk->count] = line;
    chunk->count++;
}

void writeConstant(Chunk* chunk, Value value, int line) {
    int constIndex = addConstant(chunk, value);
    if (constIndex < 256) {
        writeChunk(chunk, OP_CONSTANT, line);
        writeChunk(chunk, constIndex, line);
    } else {
        writeChunk(chunk, OP_CONSTANT_LONG, line);
        writeChunk(chunk, constIndex & 0xff, line);
        writeChunk(chunk, (constIndex >> 8) & 0xff, line);
        writeChunk(chunk, (constIndex >> 16) & 0xff, line);
    }
}

int addConstant(Chunk* chunk, Value value) {
    push(value);
    writeValueArray(&chunk->constants, value);
    pop();
    return chunk->constants.count - 1;
}