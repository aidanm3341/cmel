# Cmel

Cmel (see-mel) is short for Caramel, the name of my cat.
It's my implementation of Lox from [Crafting Interpreters](https://www.craftinginterpreters.com) by Robert Nystrom.

## Features

Here are the features which separate `Cmel` from `Lox`.

- Support from 2^24 constant values in a script
- Local `const` values

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
- [ ] Arrays/Lists
- [ ] Postfix Operators (e.g. ++ and --)
- [ ] Ternary Operator
- [ ] Modulo Operator
- [ ] String Escape Characters
- [ ] String interpolation
- [ ] Implicit convert to string on all types for concatenation
- [ ] Try/Catch
- [ ] Anonymous Functions
- [ ] Modules
- [ ] User facing Hash Tables (Including non-string keys)
- [ ] Continue Statement
- [ ] Break Statement
- [ ] Switch Statement

### Tooling

- [ ] Syntax Highlighter
- [ ] Language Server
- [ ] Test Runner

### Misc

- In chapter 18 it's mentioned that `a <= b` should not be the same as `!(a > b)` but in cmel it is. Fix by introducing dedicated instructions for `<=`, `>=` and maybe `!=` while you're at it
