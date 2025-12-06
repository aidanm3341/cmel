# Cmel Language

A Visual Studio Code extension providing language support for Cmel, a scripting language.

## Features

This extension provides comprehensive language support for `.cmel` files, including:

### Editor Features
- **Syntax Highlighting**: Color coding for keywords, strings, and operators
- **Bracket Matching**: Automatic matching and highlighting of brackets, parentheses, and braces
- **Auto-Closing Pairs**: Automatic closing of brackets, quotes, and parentheses
- **Comment Support**: Line comments (`//`) and block comments (`/* */`)

### Language Server Features
- **IntelliSense**: Code completion for variables, functions, and imported symbols
- **Go to Definition**: Navigate to symbol definitions with Cmd+Click
- **Find All References**: Find all usages of a symbol
- **Hover Information**: See type and definition information on hover
- **Diagnostics**: Real-time error and warning detection
- **Import Resolution**: Automatically recognizes symbols from imported modules
- **Rename Symbol**: Rename variables and functions across your codebase

### Supported Language Features

The extension recognizes the following Cmel language constructs:

- **Control Flow**: `if`, `else`, `while`, `for`, `return`, `break`
- **Declarations**: `var`, `fun`, `class`
- **Operators**: `print`, `or`, `and`
- **Object-Oriented**: `this`, `super`
- **String Literals**: Double-quoted strings with escape sequence support (`\n`, `\t`, `\r`, `\"`, `\\`)

## Development

### Building and Installing

To build and install the extension locally:

**Option 1: Using the install script**
```bash
cd cmel-language
./install-extension.sh
```

**Option 2: Manual installation**
```bash
cd cmel-language
npm run compile      # Compile TypeScript
npm run package      # Package the extension
code --install-extension cmel-language-0.0.1.vsix --force
```

After installation, reload VS Code to activate the extension.

### Development Workflow

```bash
npm run compile      # Compile TypeScript
npm run watch        # Watch mode for development
npm run package      # Create VSIX package
```

## Usage

Once installed, the extension automatically activates when you open any file with the `.cmel` extension. You'll get full language support including:

- Syntax highlighting
- Code completion
- Error detection
- Import resolution for `stdlib/` modules
- Go to definition, find references, and rename refactoring

## Release Notes

### 0.0.1

Initial release of Cmel language support for VS Code.
