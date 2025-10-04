#include <stdio.h>
#include <string.h>

#include "object.h"
#include "memory.h"
#include "value.h"

void initValueArray(ValueArray* array) {
    array->values = NULL;
    array->capacity = 0;
    array->count = 0;
}

void writeValueArray(ValueArray* array, Value value) {
    if (array->capacity < array->count + 1) {
        int oldCapacity = array->capacity;
        array->capacity = GROW_CAPACITY(oldCapacity);
        array->values = GROW_ARRAY(Value, array->values, oldCapacity, array->capacity);
    }

    array->values[array->count] = value;
    array->count++;
}

void freeValueArray(ValueArray* array) {
    FREE_ARRAY(Value, array->values, array->capacity);
    initValueArray(array);
}

void printValue(Value value) {
    switch (value.type) {
        case VAL_BOOL: printf(AS_BOOL(value) ? "true" : "false"); break;
        case VAL_NIL: printf("nil"); break;
        case VAL_NUMBER: {
            if (AS_NUMBER(value) < 1000000) {
                printf("%g", AS_NUMBER(value));
            } else {
                printf("%f", AS_NUMBER(value));
            }
            break;
        }
        case VAL_OBJ: printObject(value); break;
        case VAL_ERROR: printf("Error Value encountered."); break;
    }
}

bool valuesEqual(Value a, Value b) {
    if (a.type != b.type) return false;
    switch (a.type) {
        case VAL_BOOL: return AS_BOOL(a) == AS_BOOL(b);
        case VAL_NIL: return true;
        case VAL_NUMBER: return AS_NUMBER(a) == AS_NUMBER(b);
        case VAL_OBJ: return AS_OBJ(a) == AS_OBJ(b);
        default: return false; // unreachable
    }
}

ObjString* valueToString(Value value) {
    switch (value.type) {
        case VAL_BOOL: {
            return AS_BOOL(value) ? copyString("true", 4) : copyString("false", 5);
        }
        case VAL_NIL: {
            return copyString("nil", 3);
        }
        case VAL_NUMBER: {
            char buffer[24];
            int length;
            if (AS_NUMBER(value) < 1000000) {
                length = snprintf(buffer, sizeof(buffer), "%g", AS_NUMBER(value));
            } else {
                length = snprintf(buffer, sizeof(buffer), "%f", AS_NUMBER(value));
            }
            return copyString(buffer, length);
        }
        case VAL_OBJ: {
            if (IS_STRING(value)) {
                return AS_STRING(value);
            }
            // For other objects, return a string representation
            return copyString("[object]", 8);
        }
        default: {
            return copyString("[unknown]", 9);
        }
    }
}