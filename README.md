# Cmel

Cmel (see-mel) is short for Caramel, the name of my cat.
![Caramel](./caramel.jpeg)
It's my implementation of Lox from [Crafting Interpreters](https://www.craftinginterpreters.com) by Robert Nystrom.

## Features

Here are the features which separate `Cmel` from `Lox`.

- Support for 2^24 constant values in a script
- Local `const` values
- Has a `break` statement to exit from loops early
- Built-ins
- Primitive methods (e.g. `"string".length()`)
- Lists
- Maps (hash tables with string keys)
- Modulo operator
- String escape sequences (`\n`, `\t`, `\r`, `\"`, `\\`, `\e`)
- Automatic type-to-string conversion with the `+` operator
- Module system with `import` statement and standard library

### Primitive Types

- Nil
- Boolean
- String
    - `length()` returns the number of characters in the string
    - `split(delimiter)` returns a list of elements in the given string as separated by the delimiter
    - Supports escape sequences: `\n` (newline), `\t` (tab), `\r` (carriage return), `\"` (quote), `\\` (backslash)
    - When using the `+` operator with a string and any other type, the non-string operand is automatically converted to a string (e.g., `"Answer: " + 42` produces `"Answer: 42"`)
- Number
    - `add(Number)` returns the number plus the passed number
- List
    - `add(value)` mutates the list by adding the given value and returns the same list
    - `remove(index)` mutates the list by removing the value at the given index and returns the same list
    - `length()` returns the length of the list
- Map (hash table with string keys)
    - `keys()` returns a list of all keys in the map
    - `values()` returns a list of all values in the map
    - `has(key)` returns true if the key exists in the map
    - `remove(key)` removes the key-value pair and returns the value (or nil if not found)
    - `length()` returns the number of key-value pairs in the map
    - Access via subscript: `map["key"]` returns value or nil
    - Set via subscript: `map["key"] = value`
    - Literal syntax: `{"key1": value1, "key2": value2}`

### Module System

Import functions from `.cmel` modules using the `import` statement:

```cmel
import PI, sqrt, abs from "stdlib/math";
print PI;        // 3.14159
print sqrt(16);  // 4
print abs(-5);   // 5

// Wildcard import
import "stdlib/io";
var time = clock();
```

**All native functions require imports.** Modules are executed once and cached.

**Standard Library:**
- `stdlib/convert.cmel` - Type conversion utilities: `number()`
- `stdlib/io.cmel` - I/O functions: `clock()`, `input()`, `readFile()`
- `stdlib/math.cmel` - Native math functions: `abs()`, `max()`, `min()`, `pow()`, `sqrt()`, and constants `PI`, `E`
- `stdlib/string.cmel` - String functions: `startsWith()`, `endsWith()`, `join()`, `reverse()`
- `stdlib/list.cmel` - List functions: `slice()`, `sort()`, `sortWith()`, `createListWithDefaults()`
- `stdlib/test.cmel` - Testing framework: `suite()`, `test()`, `assert()`, `assertEqual()`, `run()`

## Installation

### Quick Install

To build and install Cmel system-wide:

```bash
./install.sh
```

This will compile the interpreter and install it to `/usr/local/bin`, making it available from anywhere on your system.

After installation, you can run:
```bash
cmel              # Start REPL
cmel <file.cmel>  # Run a Cmel file
```

### Uninstall

To remove Cmel from your system:

```bash
./uninstall.sh
```

## Usage

### Manual Build (without installing)

Compile the project using:

```bash
./build.sh
```

Then, you can either run `cmel` as a REPL:

```bash
./cmel
```

or execute a file by passing it the path:

```bash
./cmel <filepath>
```

## Testing

To test the code, first build the executable using the build script, then run

```
node cmel.test.mjs
```

Tests use inline expectations with `// expect:` comments.

## Todo

### Language Features

- [ ] Widen `const` to work for global variables
- [x] Arrays/Lists
- [x] File Reading
- [ ] Postfix Operators (e.g. ++ and --)
- [ ] Ternary Operator
- [x] Modulo Operator
- [x] String Escape Characters
- [ ] String interpolation
- [x] Implicit convert to string on all types for concatenation
- [ ] Try/Catch
- [x] Anonymous Functions
- [x] Modules
- [x] User facing Hash Tables (string keys only)
- [x] Hash Tables
- [ ] Hash Tables with non-string keys
- [ ] Continue Statement
- [x] Break Statement
- [ ] Switch Statement
- [ ] Typeof operator
- [ ] toString method on instances

### Tooling

- [x] Syntax Highlighter
- [x] Language Server
- [x] Test Runner

### Misc

- In chapter 18 it's mentioned that `a <= b` should not be the same as `!(a > b)` but in cmel it is. Fix by introducing dedicated instructions for `<=`, `>=` and maybe `!=` while you're at it
