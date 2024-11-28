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
- Modulo operator

### Primitive Types

- Nil
- Boolean
- String
    - `length()` returns the number of characters in the string
    - `split(delimiter)` returns a list of elements in the given string as separated by the delimiter
- Number
    - `add(Number)` returns the number plus the passed number
- List
    - `add(value)` mutates the list by adding the given value and returns the same list
    - `remove(index)` mutates the list by removing the value at the given index and returns the same list
    - `length()` returns the length of the list

### Built-in Functions

- `input()` gets and returns a value from stdin
- `clock()` returns the current time since the program started in seconds
- `readFile(path)` returns the content of the given path as a String
- `number(val)` returns a number representation of the given value. Only numbers, booleans and strings may be passed

## Usage

Compile the project using

```
./build.sh
```

Then, you can either run `cmel` as a REPL

```
./cmel
```

or execute a file by passing it the path

```
./cmel <filepath>
```

## Testing

To test the code, first build the executable using the build script, then navigate to the test folder and run

```
node --test
```

## Todo

### Language Features

- [ ] Widen `const` to work for global variables
- [x] Arrays/Lists
- [x] File Reading
- [ ] Postfix Operators (e.g. ++ and --)
- [ ] Ternary Operator
- [x] Modulo Operator
- [ ] String Escape Characters
- [ ] String interpolation
- [ ] Implicit convert to string on all types for concatenation
- [ ] Try/Catch
- [ ] Anonymous Functions
- [ ] Modules
- [ ] User facing Hash Tables (Including non-string keys)
- [ ] Continue Statement
- [x] Break Statement
- [ ] Switch Statement
- [ ] Typeof operator
- [ ] toString method on instances

### Tooling

- [x] Syntax Highlighter
- [ ] Language Server
- [x] Test Runner

### Misc

- In chapter 18 it's mentioned that `a <= b` should not be the same as `!(a > b)` but in cmel it is. Fix by introducing dedicated instructions for `<=`, `>=` and maybe `!=` while you're at it
