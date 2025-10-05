// Semantic analyzer with symbol table and scope tracking

import * as AST from './ast';
import { Token, TokenType } from './scanner';

export interface Symbol {
  name: string;
  kind: 'variable' | 'function' | 'class' | 'parameter' | 'method' | 'field';
  isConst: boolean;
  isExport: boolean;
  declarationNode: AST.ASTNode;
  declarationToken: Token;
  scope: Scope;
  type?: string; // inferred type
}

export interface SymbolReference {
  symbol: Symbol;
  token: Token;
  node: AST.ASTNode;
}

export class Scope {
  parent: Scope | null;
  symbols: Map<string, Symbol> = new Map();
  children: Scope[] = [];

  constructor(parent: Scope | null = null) {
    this.parent = parent;
    if (parent) {
      parent.children.push(this);
    }
  }

  define(symbol: Symbol): void {
    this.symbols.set(symbol.name, symbol);
  }

  resolve(name: string): Symbol | null {
    const symbol = this.symbols.get(name);
    if (symbol) return symbol;
    if (this.parent) return this.parent.resolve(name);
    return null;
  }

  resolveLocal(name: string): Symbol | null {
    return this.symbols.get(name) || null;
  }
}

export interface Diagnostic {
  message: string;
  line: number;
  start: number;
  end: number;
  severity: 'error' | 'warning' | 'info';
}

export class Analyzer {
  private globalScope: Scope;
  private currentScope: Scope;
  private symbols: Map<string, Symbol> = new Map();
  private references: Map<string, SymbolReference[]> = new Map();
  private diagnostics: Diagnostic[] = [];
  private inLoop = 0;
  private inFunction = 0;
  private inClass = 0;

  constructor() {
    this.globalScope = new Scope();
    this.currentScope = this.globalScope;
    this.defineBuiltins();
  }

  private defineBuiltins(): void {
    // Built-in functions
    const builtins = ['clock', 'input', 'readFile', 'number'];
    for (const name of builtins) {
      const symbol: Symbol = {
        name,
        kind: 'function',
        isConst: true,
        isExport: false,
        declarationNode: { kind: 'Program', body: [], start: 0, end: 0, line: 0 } as AST.Program,
        declarationToken: { type: TokenType.IDENTIFIER, lexeme: name, line: 0, column: 0, start: 0, end: 0 },
        scope: this.globalScope,
        type: 'function'
      };
      this.globalScope.define(symbol);
      this.symbols.set(name, symbol);
    }

    // Primitive classes
    const primitives = ['String', 'Number', 'List', 'Map'];
    for (const name of primitives) {
      const symbol: Symbol = {
        name,
        kind: 'class',
        isConst: true,
        isExport: false,
        declarationNode: { kind: 'Program', body: [], start: 0, end: 0, line: 0 } as AST.Program,
        declarationToken: { type: TokenType.IDENTIFIER, lexeme: name, line: 0, column: 0, start: 0, end: 0 },
        scope: this.globalScope,
        type: 'class'
      };
      this.globalScope.define(symbol);
      this.symbols.set(name, symbol);
    }
  }

  analyze(program: AST.Program): void {
    this.diagnostics = [];
    this.visitProgram(program);
  }

  getSymbols(): Map<string, Symbol> {
    return this.symbols;
  }

  getReferences(symbolName: string): SymbolReference[] {
    return this.references.get(symbolName) || [];
  }

  getDiagnostics(): Diagnostic[] {
    return this.diagnostics;
  }

  getSymbolAt(offset: number): Symbol | null {
    for (const refs of this.references.values()) {
      for (const ref of refs) {
        if (offset >= ref.token.start && offset <= ref.token.end) {
          return ref.symbol;
        }
      }
    }

    // Check declarations
    for (const symbol of this.symbols.values()) {
      const token = symbol.declarationToken;
      if (offset >= token.start && offset <= token.end) {
        return symbol;
      }
    }

    return null;
  }

  private addDiagnostic(message: string, node: AST.ASTNode, severity: 'error' | 'warning' | 'info' = 'error'): void {
    this.diagnostics.push({
      message,
      line: node.line,
      start: node.start,
      end: node.end,
      severity
    });
  }

  private addReference(symbol: Symbol, token: Token, node: AST.ASTNode): void {
    if (!this.references.has(symbol.name)) {
      this.references.set(symbol.name, []);
    }
    this.references.get(symbol.name)!.push({ symbol, token, node });
  }

  private visitProgram(program: AST.Program): void {
    for (const stmt of program.body) {
      this.visitStatement(stmt);
    }
  }

  private visitStatement(stmt: AST.Statement): void {
    switch (stmt.kind) {
      case 'VarDeclaration':
        this.visitVarDeclaration(stmt);
        break;
      case 'FunDeclaration':
        this.visitFunDeclaration(stmt);
        break;
      case 'ClassDeclaration':
        this.visitClassDeclaration(stmt);
        break;
      case 'ExpressionStatement':
        this.visitExpression(stmt.expression);
        break;
      case 'PrintStatement':
        this.visitExpression(stmt.expression);
        break;
      case 'IfStatement':
        this.visitIfStatement(stmt);
        break;
      case 'WhileStatement':
        this.visitWhileStatement(stmt);
        break;
      case 'ForStatement':
        this.visitForStatement(stmt);
        break;
      case 'ReturnStatement':
        this.visitReturnStatement(stmt);
        break;
      case 'BreakStatement':
        this.visitBreakStatement(stmt);
        break;
      case 'BlockStatement':
        this.visitBlockStatement(stmt);
        break;
      case 'ImportStatement':
        this.visitImportStatement(stmt);
        break;
    }
  }

  private visitVarDeclaration(stmt: AST.VarDeclaration): void {
    // Check for redeclaration in current scope
    const existing = this.currentScope.resolveLocal(stmt.name.lexeme);
    if (existing) {
      this.addDiagnostic(
        `Variable '${stmt.name.lexeme}' is already declared in this scope`,
        stmt,
        'error'
      );
    }

    const symbol: Symbol = {
      name: stmt.name.lexeme,
      kind: 'variable',
      isConst: stmt.isConst,
      isExport: stmt.isExport,
      declarationNode: stmt,
      declarationToken: stmt.name,
      scope: this.currentScope,
    };

    this.currentScope.define(symbol);
    this.symbols.set(stmt.name.lexeme, symbol);

    if (stmt.initializer) {
      this.visitExpression(stmt.initializer);
    }
  }

  private visitFunDeclaration(stmt: AST.FunDeclaration): void {
    const symbol: Symbol = {
      name: stmt.name.lexeme,
      kind: 'function',
      isConst: true,
      isExport: stmt.isExport,
      declarationNode: stmt,
      declarationToken: stmt.name,
      scope: this.currentScope,
      type: 'function'
    };

    this.currentScope.define(symbol);
    this.symbols.set(stmt.name.lexeme, symbol);

    // Create new scope for function body
    const previousScope = this.currentScope;
    this.currentScope = new Scope(previousScope);
    this.inFunction++;

    // Add parameters to function scope
    for (const param of stmt.params) {
      const paramSymbol: Symbol = {
        name: param.lexeme,
        kind: 'parameter',
        isConst: false,
        isExport: false,
        declarationNode: stmt,
        declarationToken: param,
        scope: this.currentScope,
      };
      this.currentScope.define(paramSymbol);
      this.symbols.set(`${stmt.name.lexeme}.${param.lexeme}`, paramSymbol);
    }

    this.visitBlockStatement(stmt.body);

    this.inFunction--;
    this.currentScope = previousScope;
  }

  private visitClassDeclaration(stmt: AST.ClassDeclaration): void {
    const symbol: Symbol = {
      name: stmt.name.lexeme,
      kind: 'class',
      isConst: true,
      isExport: false,
      declarationNode: stmt,
      declarationToken: stmt.name,
      scope: this.currentScope,
      type: 'class'
    };

    this.currentScope.define(symbol);
    this.symbols.set(stmt.name.lexeme, symbol);

    if (stmt.superclass) {
      const superSymbol = this.currentScope.resolve(stmt.superclass.lexeme);
      if (!superSymbol) {
        this.addDiagnostic(
          `Undefined superclass '${stmt.superclass.lexeme}'`,
          stmt,
          'error'
        );
      } else if (superSymbol.kind !== 'class') {
        this.addDiagnostic(
          `'${stmt.superclass.lexeme}' is not a class`,
          stmt,
          'error'
        );
      } else {
        this.addReference(superSymbol, stmt.superclass, stmt);
      }
    }

    this.inClass++;

    for (const method of stmt.methods) {
      this.visitFunDeclaration(method);
    }

    this.inClass--;
  }

  private visitIfStatement(stmt: AST.IfStatement): void {
    this.visitExpression(stmt.condition);
    this.visitStatement(stmt.thenBranch);
    if (stmt.elseBranch) {
      this.visitStatement(stmt.elseBranch);
    }
  }

  private visitWhileStatement(stmt: AST.WhileStatement): void {
    this.visitExpression(stmt.condition);
    this.inLoop++;
    this.visitStatement(stmt.body);
    this.inLoop--;
  }

  private visitForStatement(stmt: AST.ForStatement): void {
    const previousScope = this.currentScope;
    this.currentScope = new Scope(previousScope);

    if (stmt.initializer) {
      this.visitStatement(stmt.initializer);
    }
    if (stmt.condition) {
      this.visitExpression(stmt.condition);
    }
    if (stmt.increment) {
      this.visitExpression(stmt.increment);
    }

    this.inLoop++;
    this.visitStatement(stmt.body);
    this.inLoop--;

    this.currentScope = previousScope;
  }

  private visitReturnStatement(stmt: AST.ReturnStatement): void {
    if (this.inFunction === 0) {
      this.addDiagnostic('Cannot return from top-level code', stmt, 'error');
    }

    if (stmt.value) {
      this.visitExpression(stmt.value);
    }
  }

  private visitBreakStatement(stmt: AST.BreakStatement): void {
    if (this.inLoop === 0) {
      this.addDiagnostic('Cannot use break outside of a loop', stmt, 'error');
    }
  }

  private visitBlockStatement(stmt: AST.BlockStatement): void {
    const previousScope = this.currentScope;
    this.currentScope = new Scope(previousScope);

    for (const statement of stmt.statements) {
      this.visitStatement(statement);
    }

    this.currentScope = previousScope;
  }

  private visitImportStatement(stmt: AST.ImportStatement): void {
    // For each imported name, create a symbol in the global scope
    // This prevents "undefined" errors for imported symbols
    for (const importedName of stmt.imports) {
      const symbol: Symbol = {
        name: importedName.lexeme,
        kind: 'variable', // Could be function, class, or variable - we don't know
        isConst: true,
        isExport: false,
        declarationNode: stmt,
        declarationToken: importedName,
        scope: this.globalScope,
      };
      this.globalScope.define(symbol);
      this.symbols.set(importedName.lexeme, symbol);
    }

    // If no specific imports (e.g., import "path" without "from"),
    // we can't know what's being imported, so we can't prevent errors
  }

  private visitExpression(expr: AST.Expression): void {
    switch (expr.kind) {
      case 'BinaryExpression':
        this.visitExpression(expr.left);
        this.visitExpression(expr.right);
        break;
      case 'UnaryExpression':
        this.visitExpression(expr.operand);
        break;
      case 'LiteralExpression':
        // Nothing to do
        break;
      case 'IdentifierExpression':
        this.visitIdentifier(expr);
        break;
      case 'AssignmentExpression':
        this.visitAssignment(expr);
        break;
      case 'CallExpression':
        this.visitCallExpression(expr);
        break;
      case 'GetExpression':
        this.visitExpression(expr.object);
        break;
      case 'SetExpression':
        this.visitExpression(expr.object);
        this.visitExpression(expr.value);
        break;
      case 'ThisExpression':
        this.visitThisExpression(expr);
        break;
      case 'SuperExpression':
        this.visitSuperExpression(expr);
        break;
      case 'ListExpression':
        for (const elem of expr.elements) {
          this.visitExpression(elem);
        }
        break;
      case 'MapExpression':
        for (const entry of expr.entries) {
          this.visitExpression(entry.key);
          this.visitExpression(entry.value);
        }
        break;
      case 'SubscriptExpression':
        this.visitExpression(expr.object);
        this.visitExpression(expr.index);
        break;
      case 'LogicalExpression':
        this.visitExpression(expr.left);
        this.visitExpression(expr.right);
        break;
      case 'LambdaExpression':
        this.visitLambdaExpression(expr);
        break;
    }
  }

  private visitIdentifier(expr: AST.IdentifierExpression): void {
    const symbol = this.currentScope.resolve(expr.name.lexeme);
    if (!symbol) {
      this.addDiagnostic(
        `Undefined variable '${expr.name.lexeme}'`,
        expr,
        'error'
      );
    } else {
      this.addReference(symbol, expr.name, expr);
    }
  }

  private visitAssignment(expr: AST.AssignmentExpression): void {
    const symbol = this.currentScope.resolve(expr.target.lexeme);
    if (!symbol) {
      this.addDiagnostic(
        `Undefined variable '${expr.target.lexeme}'`,
        expr,
        'error'
      );
    } else {
      if (symbol.isConst) {
        this.addDiagnostic(
          `Cannot assign to const variable '${expr.target.lexeme}'`,
          expr,
          'error'
        );
      }
      this.addReference(symbol, expr.target, expr);
    }
    this.visitExpression(expr.value);
  }

  private visitCallExpression(expr: AST.CallExpression): void {
    this.visitExpression(expr.callee);
    for (const arg of expr.args) {
      this.visitExpression(arg);
    }
  }

  private visitThisExpression(expr: AST.ThisExpression): void {
    if (this.inClass === 0) {
      this.addDiagnostic('Cannot use this outside of a class', expr, 'error');
    }
  }

  private visitSuperExpression(expr: AST.SuperExpression): void {
    if (this.inClass === 0) {
      this.addDiagnostic('Cannot use super outside of a class', expr, 'error');
    }
  }

  private visitLambdaExpression(expr: AST.LambdaExpression): void {
    // Create new scope for lambda body
    const previousScope = this.currentScope;
    this.currentScope = new Scope(previousScope);
    this.inFunction++;

    // Add parameters to lambda scope
    for (const param of expr.params) {
      const paramSymbol: Symbol = {
        name: param.lexeme,
        kind: 'parameter',
        isConst: false,
        isExport: false,
        declarationNode: expr,
        declarationToken: param,
        scope: this.currentScope,
      };
      this.currentScope.define(paramSymbol);
      this.symbols.set(`<lambda>.${param.lexeme}`, paramSymbol);
    }

    this.visitBlockStatement(expr.body);

    this.inFunction--;
    this.currentScope = previousScope;
  }
}
