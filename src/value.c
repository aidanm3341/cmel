#include <stdio.h>
#include <string.h>
#include <math.h>

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
            double num = AS_NUMBER(value);
            // Check if the number is a whole number (no fractional part)
            if (num == (long long)num) {
                // Print as integer (no decimal point)
                printf("%.0f", num);
            } else {
                // Print with fixed-point notation, avoiding scientific notation
                // Use a high enough precision to match %g behavior but with %f
                char buffer[64];
                // Determine appropriate decimal places based on magnitude
                // For numbers < 1, use more decimal places
                int decimal_places;
                if (fabs(num) < 0.001) {
                    decimal_places = 9;  // Very small numbers need more precision
                } else if (fabs(num) < 1) {
                    decimal_places = 6;  // Small decimals
                } else {
                    // For numbers >= 1, calculate to maintain ~6 significant figures
                    // This mimics %g behavior
                    int magnitude = (int)log10(fabs(num));
                    decimal_places = 5 - magnitude;
                    // But ensure we show at least 1 decimal place for non-whole numbers
                    if (decimal_places < 1) decimal_places = 1;
                    if (decimal_places > 10) decimal_places = 10;
                }
                snprintf(buffer, sizeof(buffer), "%.*f", decimal_places, num);
                // Remove trailing zeros
                char* end = buffer + strlen(buffer) - 1;
                while (end > buffer && *end == '0') {
                    *end = '\0';
                    end--;
                }
                // Remove trailing decimal point if all decimals were zeros
                if (end > buffer && *end == '.') {
                    *end = '\0';
                }
                printf("%s", buffer);
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
            char buffer[64];
            double num = AS_NUMBER(value);
            int length;

            // Check if the number is a whole number (no fractional part)
            if (num == (long long)num) {
                // Print as integer (no decimal point)
                length = snprintf(buffer, sizeof(buffer), "%.0f", num);
            } else {
                // Print with fixed-point notation, avoiding scientific notation
                char temp[64];
                int decimal_places;
                if (fabs(num) < 0.001) {
                    decimal_places = 9;  // Very small numbers need more precision
                } else if (fabs(num) < 1) {
                    decimal_places = 6;  // Small decimals
                } else {
                    // For numbers >= 1, calculate to maintain ~6 significant figures
                    int magnitude = (int)log10(fabs(num));
                    decimal_places = 5 - magnitude;
                    // Ensure we show at least 1 decimal place for non-whole numbers
                    if (decimal_places < 1) decimal_places = 1;
                    if (decimal_places > 10) decimal_places = 10;
                }
                snprintf(temp, sizeof(temp), "%.*f", decimal_places, num);
                // Remove trailing zeros
                char* end = temp + strlen(temp) - 1;
                while (end > temp && *end == '0') {
                    *end = '\0';
                    end--;
                }
                // Remove trailing decimal point if all decimals were zeros
                if (end > temp && *end == '.') {
                    *end = '\0';
                }
                length = strlen(temp);
                strcpy(buffer, temp);
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