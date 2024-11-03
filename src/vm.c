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

static Value clockNative(int argCount, Value* args) {
    return NUMBER_VAL((double)clock() / CLOCKS_PER_SEC);
}

static void resetStack() {
    vm.stackTop = vm.stack;
    vm.frameCount = 0;
    vm.openUpvalues = NULL;
}

static void runtimeError(const char* format, ...) {
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

static Value stringSplitNative(int argCount, Value* args) {
    if (!IS_STRING(args[0])) {
        runtimeError("Can only split using a string.");
        return ERROR_VAL();
    }

    ObjString* splitString = AS_STRING(args[0]);
    ObjString* originalString = AS_STRING(args[1]);

    ObjList* list = newList();

    if (strcmp(splitString->chars, "") == 0) {
        for (int i = 0; i < originalString->length; i++) {
            appendToList(list, OBJ_VAL(copyString(originalString->chars + i, 1)));
        }
    } else {
        int wordStart = 0;
        for (int i = 0; i < originalString->length + 1; i++) {
            if (memcmp(originalString->chars + i, splitString->chars, splitString->length) == 0 || originalString->chars[i] == '\0') {
                appendToList(list, OBJ_VAL(copyString(originalString->chars + wordStart, i - wordStart)));
                i += splitString->length;
                wordStart = i;
            }
        }
    }

    return OBJ_VAL(list);
}

static Value numberNative(int argCount, Value* args) {
    Value val = args[0];
    if (IS_NUMBER(val)) {
        return val;
    } else if (IS_BOOL(val)) {
        return AS_BOOL(val) ? NUMBER_VAL(1) : NUMBER_VAL(0);
    } else if (IS_STRING(val)) {
        ObjString* str = AS_STRING(val);
        float num = strtof(str->chars, NULL);
        return NUMBER_VAL(num);
    } else {
        runtimeError("Given type cannot be converted to a number.");
        return ERROR_VAL();
    }
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

    initTable(&vm.globals);
    initTable(&vm.strings);

    vm.initString = NULL;
    vm.initString = copyString("init", 4);


    defineNative("clock", clockNative, 0);
    defineNative("input", inputNative, 0);
    defineNative("readFile", readFileNative, 1);
    defineNative("number", numberNative, 1);

    vm.stringClass = newClass(copyString("String", 6));
    definePrimitive(vm.stringClass, "length", lengthNative, 1);
    definePrimitive(vm.stringClass, "split", stringSplitNative, 2);

    vm.numberClass = newClass(copyString("Number", 6));
    definePrimitive(vm.numberClass, "add", addNumberNative, 2);

    vm.listClass = newClass(copyString("List", 4));
    definePrimitive(vm.listClass, "add", addListNative, 2);
    definePrimitive(vm.listClass, "remove", removeListNative, 2);
    definePrimitive(vm.listClass, "length", listLengthNative, 1);
}

void freeVM() {
    freeTable(&vm.globals);
    freeTable(&vm.strings);
    vm.stringClass = NULL;
    vm.numberClass = NULL;
    vm.listClass = NULL;
    vm.initString = NULL;
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
                if (argCount != bound->native->arity) {
                    runtimeError("Expected %d arguments but got %d", bound->native->arity, argCount);
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
                if (argCount != nativeObj->arity) {
                    runtimeError("Expected %d arguments but got %d", nativeObj->arity, argCount);
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

static InterpretResult run() {
    CallFrame* frame = &vm.frames[vm.frameCount - 1];

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
        switch (instruction = READ_BYTE()) {
            case OP_ADD: {
                if (IS_STRING(peek(0)) && IS_STRING(peek(1))) {
                    concatenate();
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
                if (!tableGet(&vm.globals, name, &value)) {
                    runtimeError("Undefined variable '%s'.", name->chars);
                    return INTERPRET_RUNTIME_ERROR;
                }
                push(value);
                break;
            }
            case OP_DEFINE_GLOBAL: {
                ObjString* name = READ_STRING();
                tableSet(&vm.globals, name, peek(0));
                pop();
                break;
            }
            case OP_SET_GLOBAL: {
                ObjString* name = READ_STRING();
                if (tableSet(&vm.globals, name, peek(0))) {
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
                ObjClosure* closure = newClosure(function);
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
                if (vm.frameCount == 0) {
                    pop();
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
            case OP_INDEX: {
                Value indexVal = pop();
                Value listVal = pop();
                Value result;

                if (!IS_LIST(listVal)) {
                    runtimeError("Can only index into a list.");
                    return INTERPRET_RUNTIME_ERROR;
                }
                ObjList* list = AS_LIST(listVal);

                if (!IS_NUMBER(indexVal)) {
                    runtimeError("Index value must be a number.");
                    return INTERPRET_RUNTIME_ERROR;
                }
                int index = AS_NUMBER(indexVal);

                if (!isValidListIndex(list, index)) {
                    runtimeError("Index out of range.");
                    return INTERPRET_RUNTIME_ERROR;
                }

                result = indexFromList(list, index);
                push(result);
                break;
            }
            case OP_STORE: {
                Value item = pop();
                Value indexVal = pop();
                Value listVal = pop();

                if (!IS_LIST(listVal)) {
                    runtimeError("Can't store a value in a non-list.");
                    return INTERPRET_RUNTIME_ERROR;
                }
                ObjList* list = AS_LIST(listVal);

                if (!IS_NUMBER(indexVal)) {
                    runtimeError("Index value must be a number.");
                    return INTERPRET_RUNTIME_ERROR;
                }
                int index = AS_NUMBER(indexVal);

                if (!isValidListIndex(list, index)) {
                    runtimeError("Index out of range.");
                    return INTERPRET_RUNTIME_ERROR;
                }

                storeToList(list, index, item);
                push(item);
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

InterpretResult interpret(const char* source) {
    ObjFunction* function = compile(source);
    if (function == NULL) return INTERPRET_COMPILE_ERROR;

    push(OBJ_VAL(function));
    ObjClosure* closure = newClosure(function);
    pop();
    push(OBJ_VAL(closure));
    call(closure, 0);

    return run();
}

