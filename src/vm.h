#ifndef cmel_vm_h
#define cmel_vm_h

#include "object.h"
#include "table.h"
#include "value.h"

#define FRAMES_MAX 64
#define STACK_MAX (FRAMES_MAX * UINT8_COUNT)

typedef struct {
    ObjClosure* closure;
    uint8_t* ip;
    Value* slots;
} CallFrame;

typedef struct {
    CallFrame frames[FRAMES_MAX];
    int frameCount;

    Value stack[STACK_MAX];
    Value* stackTop;
    Table globals;
    Table strings;
    Table modules;
    ObjModule* currentModule;
    ObjString* initString;
    ObjUpvalue* openUpvalues;

    ObjClass* stringClass;
    ObjClass* numberClass;
    ObjClass* listClass;
    ObjClass* mapClass;

    size_t bytesAllocated;
    size_t nextGC;
    Obj* objects;
    int grayCount;
    int grayCapacity;
    Obj** grayStack;

    // Temporary GC roots for native functions
    Value* tempRoots;
    int tempRootCount;
    int tempRootCapacity;

    // Test mode support
    bool testMode;              // Whether in test mode
    ObjList* testFailures;      // List of failure messages
    ObjString* currentTestName; // Current test being run
} VM;

typedef enum {
    INTERPRET_OK,
    INTERPRET_COMPILE_ERROR,
    INTERPRET_RUNTIME_ERROR
} InterpretResult;

extern VM vm;

void initVM();
void freeVM();
InterpretResult interpret(const char* source);
void push(Value value);
Value pop();
void pushTempRoot(Value value);
void popTempRoot();

#endif