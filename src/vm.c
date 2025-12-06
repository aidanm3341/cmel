#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <math.h>

#include "common.h"
#include "compiler.h"
#include "debug.h"
#include "object.h"
#include "memory.h"
#include "vm.h"

VM vm;

// Forward declarations
static Value peek(int distance);
static bool call(ObjClosure* closure, int argCount);
static InterpretResult run();
static bool callValue(Value callee, int argCount);
static bool isFalsey(Value value);

static Value clockNative(int argCount, Value* args) {
    return NUMBER_VAL((double)clock() / CLOCKS_PER_SEC);
}

static void resetStack() {
    vm.stackTop = vm.stack;
    vm.frameCount = 0;
    vm.openUpvalues = NULL;
}

static void runtimeError(const char* format, ...) {
    // In test mode, capture error instead of printing and terminating
    if (vm.testMode) {
        va_list args;
        va_start(args, format);
        char buffer[1024];
        vsnprintf(buffer, sizeof(buffer), format, args);
        va_end(args);

        // Store error message in testFailures list
        if (vm.testFailures != NULL) {
            pushTempRoot(OBJ_VAL(vm.testFailures));
            ObjString* errorMsg = copyString(buffer, strlen(buffer));
            pushTempRoot(OBJ_VAL(errorMsg));

            // Add to list - need to handle capacity
            if (vm.testFailures->capacity < vm.testFailures->count + 1) {
                int oldCapacity = vm.testFailures->capacity;
                vm.testFailures->capacity = oldCapacity < 8 ? 8 : oldCapacity * 2;
                vm.testFailures->items = (Value*)realloc(vm.testFailures->items,
                    sizeof(Value) * vm.testFailures->capacity);
            }
            vm.testFailures->items[vm.testFailures->count] = OBJ_VAL(errorMsg);
            vm.testFailures->count++;

            popTempRoot();
            popTempRoot();
        }
        return; // Don't reset stack, continue execution
    }

    // Original behavior for non-test mode
    va_list args;
    va_start(args, format);
    vfprintf(stderr, format, args);
    va_end(args);
    fputs("\n", stderr);

    for (int i = vm.frameCount - 1; i >= 0; i--) {
        CallFrame* frame = &vm.frames[i];
        ObjFunction* function = frame->closure->function;
        size_t instruction = frame->ip - function->chunk.code - 1;
        fprintf(stderr, "[line %d] in ", function->chunk.lines[instruction]);
        if (function->name == NULL) {
            fprintf(stderr, "script\n");
        } else {
            fprintf(stderr, "%s\n", function->name->chars);
        }
    }
    resetStack();
}

static Value inputNative(int argCount, Value* args) {
    char input[256];
    fgets(input, sizeof(input), stdin);

    if (strlen(input) >= sizeof(input) - 1) {
        runtimeError("Input cannot be longer than 256 characters.");
        return NIL_VAL;
    }
    return OBJ_VAL(copyString(input, strlen(input) - 1));
}

static Value readFileNative(int argCount, Value* args) {
    Value pathVal = *args;
    if (!IS_STRING(pathVal)) {
        runtimeError("Argument must be a string.");
        return NIL_VAL;
    }
    char* path = AS_STRING(pathVal)->chars;

    FILE* file = fopen(path, "rb");
    if (file == NULL) {
        runtimeError("Could not open file \"%s\".\n", path);
        return NIL_VAL;
    }

    fseek(file, 0L, SEEK_END);
    size_t fileSize = ftell(file);
    rewind(file);

    char* buffer = (char*)malloc(fileSize + 1);
    if (buffer == NULL) {
        runtimeError("Not enough memory to read \"%s\".\n", path);
        return NIL_VAL;
    }

    size_t bytesRead = fread(buffer, sizeof(char), fileSize, file);
    if (bytesRead < fileSize) {
        runtimeError("Could not read file \"%s\".\n", path);
        return NIL_VAL;
    }

    buffer[bytesRead] = '\0';

    fclose(file);
    return OBJ_VAL(copyString(buffer, fileSize));
}

static Value lengthNative(int argCount, Value* args) {
    return NUMBER_VAL(AS_STRING(*args)->length);
}

static Value addNumberNative(int argCount, Value* args) {
    return NUMBER_VAL(AS_NUMBER(args[0]) + AS_NUMBER(args[1]));
}

static Value addListNative(int argCount, Value* args) {
    ObjList* list = AS_LIST(args[1]);
    Value item = args[0];
    appendToList(list, item);
    return OBJ_VAL(list);
}

static Value removeListNative(int argCount, Value* args) {
    ObjList* list = AS_LIST(args[1]);
    int index = AS_NUMBER(args[0]);

    if (!isValidListIndex(list, index)) {
        runtimeError("Index out of bounds.");
        return ERROR_VAL();
    }

    deleteFromList(list, index);
    return OBJ_VAL(list);
}

static Value listLengthNative(int argCount, Value* args) {
    return NUMBER_VAL(AS_LIST(args[0])->count);
}

static Value listMapNative(int argCount, Value* args) {
    Value transform = args[0];
    ObjList* list = AS_LIST(args[1]);

    if (!IS_CLOSURE(transform)) {
        runtimeError("Argument to map must be a function.");
        return ERROR_VAL();
    }

    ObjList* result = newList();
    pushTempRoot(OBJ_VAL(result));

    for (int i = 0; i < list->count; i++) {
        // Push closure and argument
        push(transform);
        push(list->items[i]);

        // Set up the call
        ObjClosure* closure = AS_CLOSURE(transform);
        if (!call(closure, 1)) {
            popTempRoot();
            return ERROR_VAL();
        }

        // Execute the call
        if (run() != INTERPRET_OK) {
            popTempRoot();
            return ERROR_VAL();
        }

        // Get the result
        Value mapped = pop();
        appendToList(result, mapped);
    }

    popTempRoot();
    return OBJ_VAL(result);
}

static Value listFilterNative(int argCount, Value* args) {
    Value predicate = args[0];
    ObjList* list = AS_LIST(args[1]);

    if (!IS_CLOSURE(predicate)) {
        runtimeError("Argument to filter must be a function.");
        return ERROR_VAL();
    }

    ObjList* result = newList();
    pushTempRoot(OBJ_VAL(result));

    for (int i = 0; i < list->count; i++) {
        // Push closure and argument
        push(predicate);
        push(list->items[i]);

        // Set up the call
        ObjClosure* closure = AS_CLOSURE(predicate);
        if (!call(closure, 1)) {
            popTempRoot();
            return ERROR_VAL();
        }

        // Execute the call
        if (run() != INTERPRET_OK) {
            popTempRoot();
            return ERROR_VAL();
        }

        // Get the result
        Value filterResult = pop();
        if (!isFalsey(filterResult)) {
            appendToList(result, list->items[i]);
        }
    }

    popTempRoot();
    return OBJ_VAL(result);
}

static Value listFindNative(int argCount, Value* args) {
    Value predicate = args[0];
    ObjList* list = AS_LIST(args[1]);

    if (!IS_CLOSURE(predicate)) {
        runtimeError("Argument to find must be a function.");
        return ERROR_VAL();
    }

    for (int i = 0; i < list->count; i++) {
        // Push closure and argument
        push(predicate);
        push(list->items[i]);

        // Set up the call
        ObjClosure* closure = AS_CLOSURE(predicate);
        if (!call(closure, 1)) {
            return ERROR_VAL();
        }

        // Execute the call
        if (run() != INTERPRET_OK) {
            return ERROR_VAL();
        }

        // Get the result
        Value findResult = pop();
        if (!isFalsey(findResult)) {
            return list->items[i];
        }
    }

    return NIL_VAL;
}

static Value listContainsNative(int argCount, Value* args) {
    Value value = args[0];
    ObjList* list = AS_LIST(args[1]);

    for (int i = 0; i < list->count; i++) {
        if (valuesEqual(list->items[i], value)) {
            return BOOL_VAL(true);
        }
    }

    return BOOL_VAL(false);
}

static Value listReverseNative(int argCount, Value* args) {
    ObjList* list = AS_LIST(args[0]);

    ObjList* result = newList();
    pushTempRoot(OBJ_VAL(result));

    for (int i = list->count - 1; i >= 0; i--) {
        appendToList(result, list->items[i]);
    }

    popTempRoot();
    return OBJ_VAL(result);
}

static Value listSumNative(int argCount, Value* args) {
    ObjList* list = AS_LIST(args[0]);
    double total = 0;

    for (int i = 0; i < list->count; i++) {
        if (!IS_NUMBER(list->items[i])) {
            runtimeError("List contains non-numeric value.");
            return ERROR_VAL();
        }
        total += AS_NUMBER(list->items[i]);
    }

    return NUMBER_VAL(total);
}

static Value mapKeysNative(int argCount, Value* args) {
    ObjMap* map = AS_MAP(args[0]);
    ObjList* keys = newList();
    pushTempRoot(OBJ_VAL(keys));

    for (int i = 0; i < map->table.capacity; i++) {
        Entry* entry = &map->table.entries[i];
        if (entry->key != NULL) {
            appendToList(keys, OBJ_VAL(entry->key));
        }
    }

    popTempRoot();
    return OBJ_VAL(keys);
}

static Value mapValuesNative(int argCount, Value* args) {
    ObjMap* map = AS_MAP(args[0]);
    ObjList* values = newList();
    pushTempRoot(OBJ_VAL(values));

    for (int i = 0; i < map->table.capacity; i++) {
        Entry* entry = &map->table.entries[i];
        if (entry->key != NULL) {
            appendToList(values, entry->value);
        }
    }

    popTempRoot();
    return OBJ_VAL(values);
}

static Value mapHasNative(int argCount, Value* args) {
    ObjMap* map = AS_MAP(args[1]);
    if (!IS_STRING(args[0])) {
        runtimeError("Map key must be a string.");
        return ERROR_VAL();
    }

    Value dummy;
    return BOOL_VAL(tableGet(&map->table, AS_STRING(args[0]), &dummy));
}

static Value mapRemoveNative(int argCount, Value* args) {
    ObjMap* map = AS_MAP(args[1]);
    if (!IS_STRING(args[0])) {
        runtimeError("Map key must be a string.");
        return ERROR_VAL();
    }

    Value value;
    if (tableGet(&map->table, AS_STRING(args[0]), &value)) {
        tableDelete(&map->table, AS_STRING(args[0]));
        return value;
    }

    return NIL_VAL;
}

static Value mapLengthNative(int argCount, Value* args) {
    ObjMap* map = AS_MAP(args[0]);
    int count = 0;

    for (int i = 0; i < map->table.capacity; i++) {
        if (map->table.entries[i].key != NULL) {
            count++;
        }
    }

    return NUMBER_VAL(count);
}

static Value stringSplitNative(int argCount, Value* args) {
    if (!IS_STRING(args[0])) {
        runtimeError("Can only split using a string.");
        return ERROR_VAL();
    }

    ObjString* splitString = AS_STRING(args[0]);
    ObjString* originalString = AS_STRING(args[1]);

    ObjList* list = newList();
    pushTempRoot(OBJ_VAL(list));

    if (strcmp(splitString->chars, "") == 0) {
        for (int i = 0; i < originalString->length; i++) {
            ObjString* str = copyString(originalString->chars + i, 1);
            pushTempRoot(OBJ_VAL(str));
            appendToList(list, OBJ_VAL(str));
            popTempRoot();
        }
    } else {
        int wordStart = 0;
        for (int i = 0; i < originalString->length + 1; i++) {
            if (memcmp(originalString->chars + i, splitString->chars, splitString->length) == 0 || originalString->chars[i] == '\0') {
                ObjString* str = copyString(originalString->chars + wordStart, i - wordStart);
                pushTempRoot(OBJ_VAL(str));
                appendToList(list, OBJ_VAL(str));
                popTempRoot();
                i += splitString->length;
                wordStart = i;
            }
        }
    }

    popTempRoot();
    return OBJ_VAL(list);
}

static Value charAtNative(int argCount, Value* args) {
    if (!IS_NUMBER(args[0])) {
        runtimeError("charAt() index must be a number.");
        return ERROR_VAL();
    }

    ObjString* string = AS_STRING(args[1]);
    int index = (int)AS_NUMBER(args[0]);

    // Handle negative indices
    if (index < 0) {
        index = string->length + index;
    }

    // Bounds checking
    if (index < 0 || index >= string->length) {
        runtimeError("String index out of range.");
        return ERROR_VAL();
    }

    // Return single character as a new string
    ObjString* result = copyString(string->chars + index, 1);
    return OBJ_VAL(result);
}

static Value sliceNative(int argCount, Value* args) {
    if (!IS_NUMBER(args[0])) {
        runtimeError("slice() start index must be a number.");
        return ERROR_VAL();
    }

    ObjString* string = AS_STRING(args[argCount - 1]);
    int start = (int)AS_NUMBER(args[0]);
    int end = string->length;  // Default to string length

    // Handle optional end parameter
    if (argCount == 3) {
        if (!IS_NUMBER(args[1])) {
            runtimeError("slice() end index must be a number.");
            return ERROR_VAL();
        }
        end = (int)AS_NUMBER(args[1]);
    }

    // Handle negative indices
    if (start < 0) {
        start = string->length + start;
    }
    if (end < 0) {
        end = string->length + end;
    }

    // Clamp to valid range
    if (start < 0) start = 0;
    if (end > string->length) end = string->length;
    if (start > end) start = end;

    // Calculate length and create substring
    int length = end - start;
    if (length < 0) length = 0;

    ObjString* result = copyString(string->chars + start, length);
    return OBJ_VAL(result);
}

static Value numberNative(int argCount, Value* args) {
    Value val = args[0];
    if (IS_NUMBER(val)) {
        return val;
    } else if (IS_BOOL(val)) {
        return AS_BOOL(val) ? NUMBER_VAL(1) : NUMBER_VAL(0);
    } else if (IS_STRING(val)) {
        ObjString* str = AS_STRING(val);
        double num = strtod(str->chars, NULL);
        return NUMBER_VAL(num);
    } else {
        runtimeError("Given type cannot be converted to a number.");
        return ERROR_VAL();
    }
}

// Test mode control native functions
static Value enterTestModeNative(int argCount, Value* args) {
    vm.testMode = true;
    vm.testFailures = newList();
    pushTempRoot(OBJ_VAL(vm.testFailures));
    popTempRoot();
    vm.currentTestName = NULL;
    return NIL_VAL;
}

static Value exitTestModeNative(int argCount, Value* args) {
    vm.testMode = false;
    vm.testFailures = NULL;
    vm.currentTestName = NULL;
    return NIL_VAL;
}

static Value setCurrentTestNative(int argCount, Value* args) {
    if (!IS_STRING(*args)) {
        runtimeError("Test name must be a string.");
        return NIL_VAL;
    }
    vm.currentTestName = AS_STRING(*args);
    return NIL_VAL;
}

static Value testFailedNative(int argCount, Value* args) {
    if (vm.testFailures == NULL) return BOOL_VAL(false);
    return BOOL_VAL(vm.testFailures->count > 0);
}

static Value getLastFailureNative(int argCount, Value* args) {
    if (vm.testFailures == NULL || vm.testFailures->count == 0) {
        return NIL_VAL;
    }
    Value failure = vm.testFailures->items[vm.testFailures->count - 1];
    return failure;
}

static Value clearLastFailureNative(int argCount, Value* args) {
    if (vm.testFailures != NULL && vm.testFailures->count > 0) {
        vm.testFailures->count--;
    }
    return NIL_VAL;
}

// Basic assertion native functions
static Value assertNative(int argCount, Value* args) {
    Value condition = *args;
    const char* message = "Assertion failed";

    if (argCount > 1 && IS_STRING(args[1])) {
        message = AS_STRING(args[1])->chars;
    }

    if (isFalsey(condition)) {
        runtimeError("%s", message);
        return BOOL_VAL(false);
    }
    return BOOL_VAL(true);
}

static Value assertEqualNative(int argCount, Value* args) {
    Value expected = args[0];
    Value actual = args[1];

    if (!valuesEqual(expected, actual)) {
        ObjString* expectedStr = valueToString(expected);
        ObjString* actualStr = valueToString(actual);

        pushTempRoot(OBJ_VAL(expectedStr));
        pushTempRoot(OBJ_VAL(actualStr));

        char buffer[512];
        snprintf(buffer, sizeof(buffer),
            "Expected values to be equal.\n  Expected: %s\n  Actual: %s",
            expectedStr->chars,
            actualStr->chars);

        popTempRoot();
        popTempRoot();

        runtimeError("%s", buffer);
        return BOOL_VAL(false);
    }
    return BOOL_VAL(true);
}

static void defineNative(const char* name, NativeFn function, int arity) {
    push(OBJ_VAL(copyString(name, (int)strlen(name))));
    push(OBJ_VAL(newNative(function, arity)));
    tableSet(&vm.globals, AS_STRING(vm.stack[0]), vm.stack[1]);
    pop();
    pop();
}

static void definePrimitive(ObjClass* klass, const char* name, NativeFn function, int arity) {
    push(OBJ_VAL(copyString(name, (int)strlen(name))));
    push(OBJ_VAL(newNative(function, arity)));
    tableSet(&klass->methods, AS_STRING(vm.stack[0]), vm.stack[1]);
    pop();
    pop();
}

void initVM() {
    resetStack();
    vm.objects = NULL;
    vm.bytesAllocated = 0;
    vm.nextGC = 1024 * 1024;

    vm.grayCount = 0;
    vm.grayCapacity = 0;
    vm.grayStack = NULL;

    vm.tempRootCount = 0;
    vm.tempRootCapacity = 0;
    vm.tempRoots = NULL;

    // Initialize test mode fields
    vm.testMode = false;
    vm.testFailures = NULL;
    vm.currentTestName = NULL;

    initTable(&vm.globals);
    initTable(&vm.strings);
    initTable(&vm.modules);

    vm.currentModule = NULL;
    vm.initString = NULL;
    vm.initString = copyString("init", 4);


    defineNative("clock", clockNative, 0);
    defineNative("input", inputNative, 0);
    defineNative("readFile", readFileNative, 1);
    defineNative("number", numberNative, 1);

    // Test mode control functions
    defineNative("__enterTestMode", enterTestModeNative, 0);
    defineNative("__exitTestMode", exitTestModeNative, 0);
    defineNative("__setCurrentTest", setCurrentTestNative, 1);
    defineNative("__testFailed", testFailedNative, 0);
    defineNative("__getLastFailure", getLastFailureNative, 0);
    defineNative("__clearLastFailure", clearLastFailureNative, 0);

    // Assertion functions
    defineNative("assert", assertNative, -1);
    defineNative("assertEqual", assertEqualNative, 2);

    vm.stringClass = newClass(copyString("String", 6));
    definePrimitive(vm.stringClass, "length", lengthNative, 1);
    definePrimitive(vm.stringClass, "split", stringSplitNative, 2);
    definePrimitive(vm.stringClass, "charAt", charAtNative, 2);
    definePrimitive(vm.stringClass, "slice", sliceNative, 2);

    vm.numberClass = newClass(copyString("Number", 6));
    definePrimitive(vm.numberClass, "add", addNumberNative, 2);

    vm.listClass = newClass(copyString("List", 4));
    definePrimitive(vm.listClass, "add", addListNative, 2);
    definePrimitive(vm.listClass, "remove", removeListNative, 2);
    definePrimitive(vm.listClass, "length", listLengthNative, 1);
    definePrimitive(vm.listClass, "map", listMapNative, 2);
    definePrimitive(vm.listClass, "filter", listFilterNative, 2);
    definePrimitive(vm.listClass, "find", listFindNative, 2);
    definePrimitive(vm.listClass, "contains", listContainsNative, 2);
    definePrimitive(vm.listClass, "reverse", listReverseNative, 1);
    definePrimitive(vm.listClass, "sum", listSumNative, 1);

    vm.mapClass = newClass(copyString("Map", 3));
    definePrimitive(vm.mapClass, "keys", mapKeysNative, 1);
    definePrimitive(vm.mapClass, "values", mapValuesNative, 1);
    definePrimitive(vm.mapClass, "has", mapHasNative, 2);
    definePrimitive(vm.mapClass, "remove", mapRemoveNative, 2);
    definePrimitive(vm.mapClass, "length", mapLengthNative, 1);
}

void freeVM() {
    freeTable(&vm.globals);
    freeTable(&vm.strings);
    freeTable(&vm.modules);
    vm.stringClass = NULL;
    vm.numberClass = NULL;
    vm.listClass = NULL;
    vm.mapClass = NULL;
    vm.initString = NULL;
    free(vm.tempRoots);
    freeObjects();
}

void push(Value value) {
    *vm.stackTop = value;
    vm.stackTop++;
}

Value pop() {
    vm.stackTop--;
    return *vm.stackTop;
}

void pushTempRoot(Value value) {
    if (vm.tempRootCapacity < vm.tempRootCount + 1) {
        int oldCapacity = vm.tempRootCapacity;
        vm.tempRootCapacity = oldCapacity < 8 ? 8 : oldCapacity * 2;
        vm.tempRoots = realloc(vm.tempRoots, sizeof(Value) * vm.tempRootCapacity);
    }
    vm.tempRoots[vm.tempRootCount++] = value;
}

void popTempRoot() {
    vm.tempRootCount--;
}

static Value peek(int distance) {
    return vm.stackTop[-1 - distance];
}

static bool call(ObjClosure* closure, int argCount) {
    if (argCount != closure->function->arity) {
        runtimeError("Expected %d arguments but got %d.", closure->function->arity, argCount);
        return false;
    }

    if (vm.frameCount == FRAMES_MAX) {
        runtimeError("Stack overflow.");
        return false;
    }

    CallFrame* frame = &vm.frames[vm.frameCount++];
    frame->closure = closure;
    frame->ip = closure->function->chunk.code;
    frame->slots = vm.stackTop - argCount - 1;
    return true;
}

static bool callValue(Value callee, int argCount) {
    if (IS_OBJ(callee)) {
        switch (OBJ_TYPE(callee)) {
            case OBJ_BOUND_METHOD: {
                ObjBoundMethod* bound = AS_BOUND_METHOD(callee);
                vm.stackTop[-argCount - 1] = bound->receiver;
                return call(bound->method, argCount);
            }
            case OBJ_BOUND_NATIVE: {
                ObjBoundNative* bound = AS_BOUND_NATIVE(callee);
                argCount += 1; // because we pass in the "instance" as well
                if (argCount < bound->native->arity) {
                    runtimeError("Expected at least %d arguments but got %d", bound->native->arity, argCount);
                    return false;
                }
                push(bound->receiver);
                NativeFn native = bound->native->function;
                Value result = native(argCount, vm.stackTop - argCount);
                vm.stackTop -= argCount + 1;
                push(result);
                return true;
            }
            case OBJ_CLASS: {
                ObjClass* klass = AS_CLASS(callee);
                vm.stackTop[-argCount - 1] = OBJ_VAL(newInstance(klass));
                Value initializer;
                if (tableGet(&klass->methods, vm.initString, &initializer)) {
                    return call(AS_CLOSURE(initializer), argCount);
                } else if (argCount != 0) {
                    runtimeError("Expected 0 arguments but got %d.", argCount);
                    return false;
                }
                return true;
            }
            case OBJ_CLOSURE: return call(AS_CLOSURE(callee), argCount);
            case OBJ_NATIVE: {
                ObjNative* nativeObj = (ObjNative*)AS_OBJ(callee);
                if (argCount < nativeObj->arity) {
                    runtimeError("Expected at least %d arguments but got %d", nativeObj->arity, argCount);
                    return false;
                }
                NativeFn native = AS_NATIVE(callee);
                Value result = native(argCount, vm.stackTop - argCount);
                vm.stackTop -= argCount + 1;
                if (IS_ERROR(result)) {
                    return false;
                }

                push(result);
                return true;
            }
            default: break; // non-callable object
        }
    }
    runtimeError("Can only call functions and classes.");
    return false;
}

static bool invokeFromClass(ObjClass* klass, ObjString* name, int argCount) {
    Value method;
    if (!tableGet(&klass->methods, name, &method)) {
        runtimeError("Undefined property '%s'.", name->chars);
        return false;
    }
    return call(AS_CLOSURE(method), argCount);
}

static bool invokePrimitive(ObjClass* klass, Value receiver, ObjString* name, int argCount) {
    Value method;
    if (!tableGet(&klass->methods, name, &method)) {
        runtimeError("Undefined property '%s'.", name->chars);
        return false;
    }

    push(receiver);
    return callValue(method, argCount + 1);
}

static bool invoke(ObjString* name, int argCount) {
    Value receiver = peek(argCount);

    if (IS_INSTANCE(receiver)) {
        ObjInstance* instance = AS_INSTANCE(receiver);

        Value value;
        if (tableGet(&instance->fields, name, &value)) {
            vm.stackTop[-argCount - 1] = value;
            return callValue(value, argCount);
        }

        return invokeFromClass(instance->klass, name, argCount);
    } else if (IS_STRING(receiver)) {
        return invokePrimitive(vm.stringClass, receiver, name, argCount);
    } else if (IS_NUMBER(receiver)) {
        return invokePrimitive(vm.numberClass, receiver, name, argCount);
    } else if (IS_LIST(receiver)) {
        return invokePrimitive(vm.listClass, receiver, name, argCount);
    } else if (IS_MAP(receiver)) {
        return invokePrimitive(vm.mapClass, receiver, name, argCount);
    } else {
        runtimeError("Undefined property '%s'.", name->chars);
        return false;
    }
}

static bool bindMethod(ObjClass* klass, ObjString* name) {
    Value method;
    if (!tableGet(&klass->methods, name, &method)) {
        runtimeError("Undefined property '%s'.", name->chars);
        return false;
    }

    ObjBoundMethod* bound = newBoundMethod(peek(0), AS_CLOSURE(method));
    pop();
    push(OBJ_VAL(bound));
    return true;
}

static bool bindNative(ObjClass* klass, ObjString* name) {
    Value method;
    if (!tableGet(&klass->methods, name, &method)) {
        runtimeError("Undefined property '%s'.", name->chars);
        return false;
    }

    ObjBoundNative* bound = newBoundNative(peek(0), AS_NATIVE_OBJ(method));
    pop();
    push(OBJ_VAL(bound));
    return true;
}

static ObjUpvalue* captureUpvalue(Value* local) {
    ObjUpvalue* prevUpvalue = NULL;
    ObjUpvalue* upvalue = vm.openUpvalues;
    while (upvalue != NULL && upvalue->location > local) {
        prevUpvalue = upvalue;
        upvalue = upvalue->next;
    }

    if (upvalue != NULL && upvalue->location == local) {
        return upvalue;
    }

    ObjUpvalue* createdUpvalue = newUpvalue(local);
    createdUpvalue->next = upvalue;

    if (prevUpvalue == NULL) {
        vm.openUpvalues = createdUpvalue;
    } else {
        prevUpvalue->next = createdUpvalue;
    }

    return createdUpvalue;
}

static void closeUpvalues(Value* last) {
    while (vm.openUpvalues != NULL && vm.openUpvalues->location >= last) {
        ObjUpvalue* upvalue = vm.openUpvalues;
        upvalue->closed = *upvalue->location;
        upvalue->location = &upvalue->closed;
        vm.openUpvalues = upvalue->next;
    }
}

static void defineMethod(ObjString* name) {
    Value method = peek(0);
    ObjClass* klass = AS_CLASS(peek(1));
    tableSet(&klass->methods, name, method);
    pop();
}

static bool isFalsey(Value value) {
    return IS_NIL(value) || (IS_BOOL(value) && !AS_BOOL(value));
}

static void concatenate() {
    ObjString* b = AS_STRING(peek(0));
    ObjString* a = AS_STRING(peek(1));

    int length = a->length + b->length;
    char* chars = ALLOCATE(char, length + 1);
    memcpy(chars, a->chars, a->length);
    memcpy(chars + a->length, b->chars, b->length);
    chars[length] = '\0';

    ObjString* result = takeString(chars, length);
    pop();
    pop();
    push(OBJ_VAL(result));
}

static void concatenateWithConversion() {
    // Both operands are on stack already, just call concatenate with both as strings
    // If they're already strings, great. If not, replace them with string versions.

    // Check if we need to convert top value (b)
    if (!IS_STRING(peek(0))) {
        Value bVal = pop();
        pushTempRoot(bVal);
        ObjString* bStr = valueToString(bVal);
        popTempRoot();
        push(OBJ_VAL(bStr));
    }

    // Check if we need to convert second value (a)
    if (!IS_STRING(peek(1))) {
        Value bVal = pop();  // temporarily remove b
        pushTempRoot(bVal);
        Value aVal = pop();
        pushTempRoot(aVal);
        ObjString* aStr = valueToString(aVal);
        popTempRoot();
        push(OBJ_VAL(aStr));  // push converted a
        popTempRoot();
        push(bVal);  // restore b
    }

    // Now both are strings, use regular concatenate
    concatenate();
}

// Forward declaration
static ObjModule* loadModule(const char* path);

static InterpretResult run() {
    CallFrame* frame = &vm.frames[vm.frameCount - 1];
    int initialFrameCount = vm.frameCount;

#define READ_BYTE() (*frame->ip++)
#define READ_CONSTANT() (frame->closure->function->chunk.constants.values[READ_BYTE()])
#define READ_CONSTANT_LONG() (frame->closure->function->chunk.constants.values[(READ_BYTE() | READ_BYTE() << 8 | READ_BYTE() << 16)])
#define READ_SHORT() (frame->ip += 2, (uint16_t)((frame->ip[-2] << 8) | frame->ip[-1]))
#define READ_STRING() AS_STRING(READ_CONSTANT())
#define BINARY_OP(valueType, op) \
    do { \
        if (!IS_NUMBER(peek(0)) || !IS_NUMBER(peek(1))) { \
            runtimeError("Operands must be numbers."); \
            return INTERPRET_RUNTIME_ERROR; \
        } \
        double b = AS_NUMBER(pop()); \
        double a = AS_NUMBER(pop()); \
        push(valueType(a op b)); \
    } while (false)

    for (;;) {
        // Reload frame pointer in case frames array was reallocated
        frame = &vm.frames[vm.frameCount - 1];

#ifdef DEBUG_TRACE_EXECUTION
        printf("        ");
        for (Value* slot = vm.stack; slot < vm.stackTop; slot++) {
            printf("[ ");
            printValue(*slot);
            printf(" ]");
        }
        printf("\n");
        disassembleInstruction(&frame->closure->function->chunk, (int)(frame->ip - frame->closure->function->chunk.code));
#endif
        uint8_t instruction;
        instruction = READ_BYTE();
        switch (instruction) {
            case OP_ADD: {
                if (IS_STRING(peek(0)) || IS_STRING(peek(1))) {
                    concatenateWithConversion();
                } else if (IS_NUMBER(peek(0)) && IS_NUMBER(peek(1))) {
                    double b = AS_NUMBER(pop());
                    double a = AS_NUMBER(pop());
                    push(NUMBER_VAL(a + b));
                } else {
                    runtimeError("Operands must be two numbers or two strings.");
                    return INTERPRET_RUNTIME_ERROR;
                }
                break;
            }
            case OP_SUBTRACT: BINARY_OP(NUMBER_VAL, -); break;
            case OP_MULTIPLY: BINARY_OP(NUMBER_VAL, *); break;
            case OP_DIVIDE: BINARY_OP(NUMBER_VAL, / ); break;
            case OP_MODULO: {
                if (!IS_NUMBER(peek(0)) || !IS_NUMBER(peek(1))) {
                    runtimeError("Operands must be numbers.");
                    return INTERPRET_RUNTIME_ERROR;
                }
                double b = AS_NUMBER(pop());
                double a = AS_NUMBER(pop());
                double result = fmod(a, b);
                push(NUMBER_VAL(result));
                break;
            }
            case OP_NOT: push(BOOL_VAL(isFalsey(pop()))); break;
            case OP_NEGATE: {
                if (!IS_NUMBER(peek(0))) {
                    runtimeError("Operand must be a number.");
                    return INTERPRET_RUNTIME_ERROR;
                }
                push(NUMBER_VAL(-AS_NUMBER(pop())));
                break;
            }
            case OP_PRINT: {
                printValue(pop());
                printf("\n");
                break;
            }
            case OP_CONSTANT: {
                Value constant = READ_CONSTANT();
                push(constant);
                break;
            }
            case OP_CONSTANT_LONG: {
                Value constant = READ_CONSTANT_LONG();
                push(constant);
                break;
            }
            case OP_NIL: push(NIL_VAL); break;
            case OP_TRUE: push(BOOL_VAL(true)); break;
            case OP_FALSE: push(BOOL_VAL(false)); break;
            case OP_POP: pop(); break;
            case OP_GET_LOCAL: {
                uint8_t slot = READ_BYTE();
                push(frame->slots[slot]);
                break;
            }
            case OP_SET_LOCAL: {
                uint8_t slot = READ_BYTE();
                frame->slots[slot] = peek(0);
                break;
            }
            case OP_GET_GLOBAL: {
                ObjString* name = READ_STRING();
                Value value;

                // First check module's globals if closure has a module
                if (frame->closure->module != NULL) {
                    if (tableGet(&frame->closure->module->globals, name, &value)) {
                        push(value);
                        break;
                    }
                }

                // Fall back to vm.globals for built-ins
                if (!tableGet(&vm.globals, name, &value)) {
                    runtimeError("Undefined variable '%s'.", name->chars);
                    return INTERPRET_RUNTIME_ERROR;
                }
                push(value);
                break;
            }
            case OP_DEFINE_GLOBAL: {
                ObjString* name = READ_STRING();
                // Always define in vm.globals (which is either the real globals or a temporary module namespace)
                tableSet(&vm.globals, name, peek(0));
                pop();
                break;
            }
            case OP_SET_GLOBAL: {
                ObjString* name = READ_STRING();

                // Try to set in module's globals first if closure has a module
                if (frame->closure->module != NULL) {
                    if (!tableSet(&frame->closure->module->globals, name, peek(0))) {
                        // Successfully set in module globals
                        break;
                    }
                }

                // Fall back to vm.globals
                if (tableSet(&vm.globals, name, peek(0))) {
                    // tableSet returns true if it's a new key (error for SET)
                    if (frame->closure->module != NULL) {
                        tableDelete(&frame->closure->module->globals, name);
                    }
                    tableDelete(&vm.globals, name);
                    runtimeError("Undefined variable '%s'", name->chars);
                    return INTERPRET_RUNTIME_ERROR;
                }
                break;
            }
            case OP_GET_UPVALUE: {
                uint8_t slot = READ_BYTE();
                push(*frame->closure->upvalues[slot]->location);
                break;
            }
            case OP_SET_UPVALUE: {
                uint8_t slot = READ_BYTE();
                *frame->closure->upvalues[slot]->location = peek(0);
                break;
            }
            case OP_GET_PROPERTY: {
                if (IS_INSTANCE(peek(0))) {
                    ObjInstance* instance = AS_INSTANCE(peek(0));
                    ObjString* name = READ_STRING();

                    Value value;
                    if (tableGet(&instance->fields, name, &value)) {
                        pop(); // the instance was evaluated at pushed to the stack, so we pop it off
                        push(value);
                        break;
                    }

                    if (!bindMethod(instance->klass, name)) {
                        return INTERPRET_RUNTIME_ERROR;
                    }

                    break;
                } else if (IS_STRING(peek(0))) {
                    ObjString* name = READ_STRING();

                    if (!bindNative(vm.stringClass, name)) {
                        return INTERPRET_RUNTIME_ERROR;
                    }

                    break;
                } else if (IS_NUMBER(peek(0))) {
                    ObjString* name = READ_STRING();

                    if (!bindNative(vm.numberClass, name)) {
                        return INTERPRET_RUNTIME_ERROR;
                    }

                    break;
                } else if (IS_LIST(peek(0))) {
                    ObjString* name = READ_STRING();

                    if (!bindNative(vm.listClass, name)) {
                        return INTERPRET_RUNTIME_ERROR;
                    }

                    break;
                } else if (IS_MAP(peek(0))) {
                    ObjString* name = READ_STRING();

                    if (!bindNative(vm.mapClass, name)) {
                        return INTERPRET_RUNTIME_ERROR;
                    }

                    break;
                } else if (IS_MODULE(peek(0))) {
                    ObjModule* module = AS_MODULE(peek(0));
                    ObjString* name = READ_STRING();

                    Value value;
                    if (tableGet(&module->globals, name, &value)) {
                        pop(); // Pop the module
                        push(value);
                        break;
                    }

                    runtimeError("Module '%s' has no property '%s'.", module->name->chars, name->chars);
                    return INTERPRET_RUNTIME_ERROR;
                }

                runtimeError("Only instances have properties");
                return INTERPRET_RUNTIME_ERROR;
            }
            case OP_SET_PROPERTY: {
                if (!IS_INSTANCE(peek(1))) {
                    runtimeError("Only instances have fields");
                    return INTERPRET_RUNTIME_ERROR;
                }

                ObjInstance* instance = AS_INSTANCE(peek(1));
                tableSet(&instance->fields, READ_STRING(), peek(0));
                Value value = pop();
                pop();
                push(value);
                break;
            }
            case OP_GET_SUPER: {
                ObjString* name = READ_STRING();
                ObjClass* superclass = AS_CLASS(pop());

                if (!bindMethod(superclass, name)) {
                    return INTERPRET_RUNTIME_ERROR;
                }
                break;
            }
            case OP_EQUAL: {
                Value b = pop();
                Value a = pop();
                push(BOOL_VAL(valuesEqual(a, b)));
                break;
            }
            case OP_GREATER: BINARY_OP(BOOL_VAL, > ); break;
            case OP_LESS: BINARY_OP(BOOL_VAL, < ); break;
            case OP_JUMP: {
                uint16_t offset = READ_SHORT();
                frame->ip += offset;
                break;
            }
            case OP_CALL: {
                int argCount = READ_BYTE();
                if (!callValue(peek(argCount), argCount)) {
                    return INTERPRET_RUNTIME_ERROR;
                }
                frame = &vm.frames[vm.frameCount - 1];
                break;
            }
            case OP_INVOKE: {
                ObjString* method = READ_STRING();
                int argCount = READ_BYTE();
                if (!invoke(method, argCount)) {
                    return INTERPRET_RUNTIME_ERROR;
                }
                frame = &vm.frames[vm.frameCount - 1];
                break;
            }
            case OP_SUPER_INVOKE: {
                ObjString* method = READ_STRING();
                int argCount = READ_BYTE();
                ObjClass* superclass = AS_CLASS(pop());
                if (!invokeFromClass(superclass, method, argCount)) {
                    return INTERPRET_RUNTIME_ERROR;
                }
                frame = &vm.frames[vm.frameCount - 1];
                break;
            }
            case OP_CLOSURE: {
                ObjFunction* function = AS_FUNCTION(READ_CONSTANT());
                // Inherit module from the enclosing closure
                ObjModule* module = frame->closure->module;
                ObjClosure* closure = newClosure(function, module);
                push(OBJ_VAL(closure));
                for (int i = 0; i < function->upvalueCount; i++) {
                    uint8_t isLocal = READ_BYTE();
                    uint8_t index = READ_BYTE();
                    if (isLocal) {
                        closure->upvalues[i] = captureUpvalue(frame->slots + index);
                    } else {
                        closure->upvalues[i] = frame->closure->upvalues[index];
                    }
                }
                break;
            }
            case OP_JUMP_IF_FALSE: {
                uint16_t offset = READ_SHORT();
                if (isFalsey(peek(0))) frame->ip += offset;
                break;
            }
            case OP_LOOP: {
                uint16_t offset = READ_SHORT();
                frame->ip -= offset;
                break;
            }
            case OP_CLOSE_UPVALUE: {
                closeUpvalues(vm.stackTop - 1);
                pop();
                break;
            }
            case OP_RETURN: {
                Value result = pop();
                closeUpvalues(frame->slots);
                vm.frameCount--;

                // Return from run() when we've popped back to the initial frame count
                if (vm.frameCount < initialFrameCount) {
                    vm.stackTop = frame->slots;  // Reset stack to where closure was
                    push(result);  // Push the return value for the caller
                    return INTERPRET_OK;
                }

                vm.stackTop = frame->slots;
                push(result);
                frame = &vm.frames[vm.frameCount - 1];
                break;
            }
            case OP_CLASS: {
                push(OBJ_VAL(newClass(READ_STRING())));
                break;
            }
            case OP_INHERIT: {
                Value superclass = peek(1);
                if (!IS_CLASS(superclass)) {
                    runtimeError("Superclass must be a class.");
                    return INTERPRET_RUNTIME_ERROR;
                }

                ObjClass* subclass = AS_CLASS(peek(0));
                tableAddAll(&AS_CLASS(superclass)->methods, &subclass->methods);
                pop();
                break;
            }
            case OP_METHOD: {
                defineMethod(READ_STRING());
                break;
            }
            case OP_BUILD_LIST: {
                // e.g. stack before: [1, 2, 3, 4], stack after: [someList]
                ObjList* list = newList();
                uint8_t itemCount = READ_BYTE();

                push(OBJ_VAL(list)); // to avoid accidental GCing
                for (int i = itemCount; i > 0; i--) {
                    appendToList(list, peek(i));
                }
                pop();

                while (itemCount > 0) {
                    pop();
                    itemCount--;
                }

                push(OBJ_VAL(list));
                break;
            }
            case OP_BUILD_MAP: {
                // e.g. stack before: ["key1", value1, "key2", value2], stack after: [someMap]
                ObjMap* map = newMap();
                uint8_t itemCount = READ_BYTE(); // number of key-value pairs

                push(OBJ_VAL(map)); // to avoid accidental GCing

                // Items are on stack in reverse order: first key is deepest
                for (int i = itemCount * 2; i > 0; i -= 2) {
                    Value key = peek(i);
                    Value value = peek(i - 1);

                    if (!IS_STRING(key)) {
                        runtimeError("Map keys must be strings.");
                        return INTERPRET_RUNTIME_ERROR;
                    }

                    tableSet(&map->table, AS_STRING(key), value);
                }
                pop(); // pop the map we pushed

                // Pop all key-value pairs
                for (int i = 0; i < itemCount * 2; i++) {
                    pop();
                }

                push(OBJ_VAL(map));
                break;
            }
            case OP_INDEX: {
                Value indexVal = pop();
                Value obj = pop();
                Value result;

                if (IS_LIST(obj)) {
                    ObjList* list = AS_LIST(obj);

                    if (!IS_NUMBER(indexVal)) {
                        runtimeError("List index must be a number.");
                        return INTERPRET_RUNTIME_ERROR;
                    }
                    int index = AS_NUMBER(indexVal);

                    if (!isValidListIndex(list, index)) {
                        runtimeError("List index out of range.");
                        return INTERPRET_RUNTIME_ERROR;
                    }

                    result = indexFromList(list, index);
                    push(result);
                } else if (IS_MAP(obj)) {
                    ObjMap* map = AS_MAP(obj);

                    if (!IS_STRING(indexVal)) {
                        runtimeError("Map key must be a string.");
                        return INTERPRET_RUNTIME_ERROR;
                    }

                    Value value;
                    if (tableGet(&map->table, AS_STRING(indexVal), &value)) {
                        push(value);
                    } else {
                        push(NIL_VAL);
                    }
                } else {
                    runtimeError("Can only index into lists and maps.");
                    return INTERPRET_RUNTIME_ERROR;
                }
                break;
            }
            case OP_STORE: {
                Value item = pop();
                Value indexVal = pop();
                Value obj = pop();

                if (IS_LIST(obj)) {
                    ObjList* list = AS_LIST(obj);

                    if (!IS_NUMBER(indexVal)) {
                        runtimeError("List index must be a number.");
                        return INTERPRET_RUNTIME_ERROR;
                    }
                    int index = AS_NUMBER(indexVal);

                    if (!isValidListIndex(list, index)) {
                        runtimeError("List index out of range.");
                        return INTERPRET_RUNTIME_ERROR;
                    }

                    storeToList(list, index, item);
                    push(item);
                } else if (IS_MAP(obj)) {
                    ObjMap* map = AS_MAP(obj);

                    if (!IS_STRING(indexVal)) {
                        runtimeError("Map key must be a string.");
                        return INTERPRET_RUNTIME_ERROR;
                    }

                    tableSet(&map->table, AS_STRING(indexVal), item);
                    push(item);
                } else {
                    runtimeError("Can only store values in lists and maps.");
                    return INTERPRET_RUNTIME_ERROR;
                }
                break;
            }
            case OP_IMPORT: {
                ObjString* path = READ_STRING();

                // Load the module (uses caching internally)
                ObjModule* module = loadModule(path->chars);
                if (module == NULL) {
                    runtimeError("Failed to load module \"%s\".", path->chars);
                    return INTERPRET_RUNTIME_ERROR;
                }

                // Update frame pointer (loadModule calls run() recursively)
                frame = &vm.frames[vm.frameCount - 1];

                // Import all exports into current global scope
                // Exported functions will access their module's globals via closure->module
                Table* targetTable = frame->closure->module != NULL
                    ? &frame->closure->module->globals
                    : &vm.globals;

                for (int i = 0; i < module->exports.capacity; i++) {
                    Entry* entry = &module->exports.entries[i];
                    if (entry->key != NULL) {
                        tableSet(targetTable, entry->key, entry->value);
                    }
                }

                break;
            }
            case OP_IMPORT_FROM: {
                ObjString* path = READ_STRING();
                ObjString* name = READ_STRING();

                // Load the module (uses caching internally)
                ObjModule* module = loadModule(path->chars);
                if (module == NULL) {
                    runtimeError("Failed to load module \"%s\".", path->chars);
                    return INTERPRET_RUNTIME_ERROR;
                }

                // Update frame pointer (loadModule calls run() recursively)
                frame = &vm.frames[vm.frameCount - 1];

                // Check that the named export exists
                Value value;
                if (!tableGet(&module->exports, name, &value)) {
                    runtimeError("Module '%s' has no export '%s'.", path->chars, name->chars);
                    return INTERPRET_RUNTIME_ERROR;
                }

                // Import only the requested name
                // Exported functions will access their module's globals via closure->module
                Table* targetTable = frame->closure->module != NULL
                    ? &frame->closure->module->globals
                    : &vm.globals;
                tableSet(targetTable, name, value);

                break;
            }
            case OP_EXPORT: {
                ObjString* name = READ_STRING();

                if (vm.currentModule == NULL) {
                    runtimeError("Cannot export outside of module context.");
                    return INTERPRET_RUNTIME_ERROR;
                }

                // Get the value from globals
                Value value;
                if (!tableGet(&vm.globals, name, &value)) {
                    runtimeError("Undefined variable '%s'.", name->chars);
                    return INTERPRET_RUNTIME_ERROR;
                }

                // Add to exports table
                tableSet(&vm.currentModule->exports, name, value);
                break;
            }
            case OP_PLACEHOLDER: {
                runtimeError("Placeholder instruction encountered. This must be a bug in the compiler.");
                break;
            }
        }
    }

#undef BINARY_OP
#undef READ_STRING
#undef READ_CONSTANT_LONG
#undef READ_CONSTANT
#undef READ_SHORT
#undef READ_BYTE
}

static ObjModule* loadModule(const char* path) {

    // Check if module is already loaded
    ObjString* pathString = copyString(path, (int)strlen(path));
    Value cachedModule;
    if (tableGet(&vm.modules, pathString, &cachedModule)) {
        return AS_MODULE(cachedModule);
    }


    // Build full path with .cmel extension
    char fullPath[256];
    snprintf(fullPath, sizeof(fullPath), "%s.cmel", path);

    // Read module file
    FILE* file = fopen(fullPath, "rb");
    if (file == NULL) {
        fprintf(stderr, "Could not open module file \"%s\".\n", fullPath);
        return NULL;
    }

    fseek(file, 0L, SEEK_END);
    size_t fileSize = ftell(file);
    rewind(file);

    char* source = (char*)malloc(fileSize + 1);
    if (source == NULL) {
        fclose(file);
        fprintf(stderr, "Not enough memory to read module \"%s\".\n", fullPath);
        return NULL;
    }

    size_t bytesRead = fread(source, sizeof(char), fileSize, file);
    if (bytesRead < fileSize) {
        free(source);
        fclose(file);
        fprintf(stderr, "Could not read module \"%s\".\n", fullPath);
        return NULL;
    }
    source[bytesRead] = '\0';
    fclose(file);

    // Compile the module
    ObjFunction* moduleFunction = compile(source);
    free(source);

    if (moduleFunction == NULL) {
        fprintf(stderr, "Failed to compile module \"%s\".\n", fullPath);
        return NULL;
    }

    // Save current globals, stack pointer, and module
    Table savedGlobals = vm.globals;
    Value* savedStackTop = vm.stackTop;
    ObjModule* savedModule = vm.currentModule;

    // Create module object before execution
    ObjModule* module = newModule(pathString);
    vm.currentModule = module;

    // Create fresh globals table for module
    initTable(&vm.globals);

    // Copy native functions and classes into module's globals
    // so modules can use built-in functions
    for (int i = 0; i < savedGlobals.capacity; i++) {
        Entry* entry = &savedGlobals.entries[i];
        if (entry->key != NULL) {
            // Copy natives and classes, but not user-defined globals
            if (IS_NATIVE(entry->value) || IS_CLASS(entry->value)) {
                tableSet(&vm.globals, entry->key, entry->value);
            }
        }
    }

    // Execute module in isolated scope
    push(OBJ_VAL(moduleFunction));
    ObjClosure* moduleClosure = newClosure(moduleFunction, module);
    pop();
    push(OBJ_VAL(moduleClosure));
    call(moduleClosure, 0);

    InterpretResult result = run();

    if (result != INTERPRET_OK) {
        freeTable(&vm.globals);
        vm.globals = savedGlobals;
        vm.stackTop = savedStackTop;
        vm.currentModule = savedModule;
        return NULL;
    }

    // Pop return value
    pop();

    // Copy globals to module
    tableAddAll(&vm.globals, &module->globals);

    // Restore original globals, stack pointer, and module
    freeTable(&vm.globals);
    vm.globals = savedGlobals;
    vm.stackTop = savedStackTop;
    vm.currentModule = savedModule;

    // Cache the module
    tableSet(&vm.modules, pathString, OBJ_VAL(module));

    return module;
}

InterpretResult interpret(const char* source) {
    ObjFunction* function = compile(source);
    if (function == NULL) return INTERPRET_COMPILE_ERROR;

    push(OBJ_VAL(function));
    // Main script has no module (NULL)
    ObjClosure* closure = newClosure(function, NULL);
    pop();
    push(OBJ_VAL(closure));
    call(closure, 0);

    return run();
}

