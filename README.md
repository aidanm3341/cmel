# Cmel

Cmel (see-mel) is short for Caramel, the name of my cat.
It's my implementation of Lox from [Crafting Interpreters](https://www.craftinginterpreters.com) by Robert Nystrom.

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

## Todo

### Language Features

- [ ] Arrays/Lists
- [ ] Postfix Operators (e.g. ++ and --)
- [ ] Ternary Operator
- [ ] String interpolation
- [ ] Try/Catch
- [ ] Anonymous Functions
- [ ] Modules

### Tooling

- [ ] Syntax Highlighter
- [ ] Language Server
- [ ] Test Runner

### Misc

- In chapter 18 it's mentioned that `a <= b` should not be the same as `!(a > b)` but in cmel it is. Fix by introducing dedicated instructions for `<=`, `>=` and maybe `!=` while you're at it
