// Recursive descent parser for Cmel

import { Token, TokenType } from './scanner';
import * as AST from './ast';

export interface ParseError {
  message: string;
  token: Token;
}

export class Parser {
  private tokens: Token[];
  private current = 0;
  private errors: ParseError[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  getErrors(): ParseError[] {
    return this.errors;
  }

  parse(): AST.Program {
    const statements: AST.Statement[] = [];

    while (!this.isAtEnd()) {
      const stmt = this.declaration();
      if (stmt) {
        statements.push(stmt);
      }
    }

    return {
      kind: 'Program',
      body: statements,
      start: 0,
      end: this.previous().end,
      line: 1
    };
  }

  private declaration(): AST.Statement | null {
    try {
      const isExport = this.match(TokenType.EXPORT);

      if (this.match(TokenType.VAR) || this.check(TokenType.CONST)) {
        return this.varDeclaration(isExport);
      }
      if (this.match(TokenType.FUN)) {
        return this.funDeclaration(isExport);
      }
      if (this.match(TokenType.CLASS)) {
        return this.classDeclaration(isExport);
      }

      return this.statement();
    } catch (error) {
      this.synchronize();
      return null;
    }
  }

  private varDeclaration(isExport: boolean): AST.VarDeclaration {
    const isConst = this.match(TokenType.CONST);
    if (!isConst) {
      // already consumed VAR
    }

    const name = this.consume(TokenType.IDENTIFIER, 'Expected variable name');

    let initializer: AST.Expression | null = null;
    if (this.match(TokenType.EQUAL)) {
      initializer = this.expression();
    }

    this.consume(TokenType.SEMICOLON, 'Expected ; after variable declaration');

    return {
      kind: 'VarDeclaration',
      name,
      isConst,
      isExport,
      initializer,
      start: name.start,
      end: this.previous().end,
      line: name.line
    };
  }

  private funDeclaration(isExport: boolean): AST.FunDeclaration {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected function name');

    this.consume(TokenType.LEFT_PAREN, 'Expected ( after function name');
    const params: Token[] = [];

    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        params.push(this.consume(TokenType.IDENTIFIER, 'Expected parameter name'));
      } while (this.match(TokenType.COMMA));
    }

    this.consume(TokenType.RIGHT_PAREN, 'Expected ) after parameters');
    this.consume(TokenType.LEFT_BRACE, 'Expected { before function body');

    const body = this.blockStatement();

    return {
      kind: 'FunDeclaration',
      name,
      params,
      body,
      isExport,
      start: name.start,
      end: body.end,
      line: name.line
    };
  }

  private classDeclaration(isExport: boolean): AST.ClassDeclaration {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected class name');

    let superclass: Token | null = null;
    if (this.match(TokenType.LESS)) {
      superclass = this.consume(TokenType.IDENTIFIER, 'Expected superclass name');
    }

    this.consume(TokenType.LEFT_BRACE, 'Expected { before class body');

    const methods: AST.FunDeclaration[] = [];
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      const methodName = this.consume(TokenType.IDENTIFIER, 'Expected method name');

      this.consume(TokenType.LEFT_PAREN, 'Expected ( after method name');
      const params: Token[] = [];

      if (!this.check(TokenType.RIGHT_PAREN)) {
        do {
          params.push(this.consume(TokenType.IDENTIFIER, 'Expected parameter name'));
        } while (this.match(TokenType.COMMA));
      }

      this.consume(TokenType.RIGHT_PAREN, 'Expected ) after parameters');
      this.consume(TokenType.LEFT_BRACE, 'Expected { before method body');

      const body = this.blockStatement();

      methods.push({
        kind: 'FunDeclaration',
        name: methodName,
        params,
        body,
        isExport: false,
        start: methodName.start,
        end: body.end,
        line: methodName.line
      });
    }

    const endBrace = this.consume(TokenType.RIGHT_BRACE, 'Expected } after class body');

    return {
      kind: 'ClassDeclaration',
      name,
      superclass,
      methods,
      isExport,
      start: name.start,
      end: endBrace.end,
      line: name.line
    };
  }

  private statement(): AST.Statement {
    if (this.match(TokenType.PRINT)) {
      return this.printStatement();
    }
    if (this.match(TokenType.IF)) {
      return this.ifStatement();
    }
    if (this.match(TokenType.WHILE)) {
      return this.whileStatement();
    }
    if (this.match(TokenType.FOR)) {
      return this.forStatement();
    }
    if (this.match(TokenType.RETURN)) {
      return this.returnStatement();
    }
    if (this.match(TokenType.BREAK)) {
      return this.breakStatement();
    }
    if (this.match(TokenType.LEFT_BRACE)) {
      return this.blockStatement();
    }
    if (this.match(TokenType.IMPORT)) {
      return this.importStatement();
    }

    return this.expressionStatement();
  }

  private printStatement(): AST.PrintStatement {
    const start = this.previous().start;
    const expr = this.expression();
    this.consume(TokenType.SEMICOLON, 'Expected ; after value');

    return {
      kind: 'PrintStatement',
      expression: expr,
      start,
      end: this.previous().end,
      line: this.previous().line
    };
  }

  private ifStatement(): AST.IfStatement {
    const start = this.previous().start;

    this.consume(TokenType.LEFT_PAREN, 'Expected ( after if');
    const condition = this.expression();
    this.consume(TokenType.RIGHT_PAREN, 'Expected ) after condition');

    const thenBranch = this.statement();
    let elseBranch: AST.Statement | null = null;

    if (this.match(TokenType.ELSE)) {
      elseBranch = this.statement();
    }

    return {
      kind: 'IfStatement',
      condition,
      thenBranch,
      elseBranch,
      start,
      end: (elseBranch || thenBranch).end,
      line: this.previous().line
    };
  }

  private whileStatement(): AST.WhileStatement {
    const start = this.previous().start;

    this.consume(TokenType.LEFT_PAREN, 'Expected ( after while');
    const condition = this.expression();
    this.consume(TokenType.RIGHT_PAREN, 'Expected ) after condition');

    const body = this.statement();

    return {
      kind: 'WhileStatement',
      condition,
      body,
      start,
      end: body.end,
      line: this.previous().line
    };
  }

  private forStatement(): AST.ForStatement {
    const start = this.previous().start;

    this.consume(TokenType.LEFT_PAREN, 'Expected ( after for');

    let initializer: AST.Statement | null = null;
    if (this.match(TokenType.SEMICOLON)) {
      initializer = null;
    } else if (this.match(TokenType.VAR) || this.check(TokenType.CONST)) {
      // Parse variable declaration inline for for-loops
      const isConst = this.match(TokenType.CONST);
      const name = this.consume(TokenType.IDENTIFIER, 'Expected variable name');
      let init: AST.Expression | null = null;
      if (this.match(TokenType.EQUAL)) {
        init = this.expression();
      }
      this.consume(TokenType.SEMICOLON, 'Expected ; after loop initializer');

      initializer = {
        kind: 'VarDeclaration',
        name,
        isConst,
        isExport: false,
        initializer: init,
        start: name.start,
        end: this.previous().end,
        line: name.line
      };
    } else {
      initializer = this.expressionStatement();
    }

    let condition: AST.Expression | null = null;
    if (!this.check(TokenType.SEMICOLON)) {
      condition = this.expression();
    }
    this.consume(TokenType.SEMICOLON, 'Expected ; after loop condition');

    let increment: AST.Expression | null = null;
    if (!this.check(TokenType.RIGHT_PAREN)) {
      increment = this.expression();
    }
    this.consume(TokenType.RIGHT_PAREN, 'Expected ) after for clauses');

    const body = this.statement();

    return {
      kind: 'ForStatement',
      initializer,
      condition,
      increment,
      body,
      start,
      end: body.end,
      line: this.previous().line
    };
  }

  private returnStatement(): AST.ReturnStatement {
    const start = this.previous().start;

    let value: AST.Expression | null = null;
    if (!this.check(TokenType.SEMICOLON)) {
      value = this.expression();
    }

    this.consume(TokenType.SEMICOLON, 'Expected ; after return value');

    return {
      kind: 'ReturnStatement',
      value,
      start,
      end: this.previous().end,
      line: this.previous().line
    };
  }

  private breakStatement(): AST.BreakStatement {
    const start = this.previous().start;
    this.consume(TokenType.SEMICOLON, 'Expected ; after break');

    return {
      kind: 'BreakStatement',
      start,
      end: this.previous().end,
      line: this.previous().line
    };
  }

  private blockStatement(): AST.BlockStatement {
    const start = this.previous().start;
    const statements: AST.Statement[] = [];

    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      const stmt = this.declaration();
      if (stmt) {
        statements.push(stmt);
      }
    }

    const endBrace = this.consume(TokenType.RIGHT_BRACE, 'Expected } after block');

    return {
      kind: 'BlockStatement',
      statements,
      start,
      end: endBrace.end,
      line: this.previous().line
    };
  }

  private importStatement(): AST.ImportStatement {
    const start = this.previous().start;

    // Support both: import "path" and import name1, name2, ... from "path"
    const imports: Token[] = [];

    if (this.check(TokenType.IDENTIFIER)) {
      // Parse comma-separated list of imports
      do {
        imports.push(this.consume(TokenType.IDENTIFIER, 'Expected import name'));
      } while (this.match(TokenType.COMMA));

      this.consume(TokenType.FROM, 'Expected "from" after import list');
    }

    const path = this.consume(TokenType.STRING, 'Expected import path');
    this.consume(TokenType.SEMICOLON, 'Expected ; after import');

    return {
      kind: 'ImportStatement',
      path,
      imports,
      start,
      end: this.previous().end,
      line: this.previous().line
    };
  }

  private expressionStatement(): AST.ExpressionStatement {
    const expr = this.expression();
    this.consume(TokenType.SEMICOLON, 'Expected ; after expression');

    return {
      kind: 'ExpressionStatement',
      expression: expr,
      start: expr.start,
      end: this.previous().end,
      line: expr.line
    };
  }

  private expression(): AST.Expression {
    return this.assignment();
  }

  private assignment(): AST.Expression {
    const expr = this.or();

    if (this.match(TokenType.EQUAL)) {
      const equals = this.previous();
      const value = this.assignment();

      if (expr.kind === 'IdentifierExpression') {
        return {
          kind: 'AssignmentExpression',
          target: expr.name,
          value,
          start: expr.start,
          end: value.end,
          line: expr.line
        };
      } else if (expr.kind === 'GetExpression') {
        return {
          kind: 'SetExpression',
          object: expr.object,
          property: expr.property,
          value,
          start: expr.start,
          end: value.end,
          line: expr.line
        };
      } else if (expr.kind === 'SubscriptExpression') {
        // For map[key] = value, convert to SetExpression
        return {
          kind: 'SetExpression',
          object: expr.object,
          property: { ...equals, lexeme: '[]' }, // dummy token
          value,
          start: expr.start,
          end: value.end,
          line: expr.line
        };
      }

      throw new Error('Invalid assignment target');
    }

    return expr;
  }

  private or(): AST.Expression {
    let expr = this.and();

    while (this.match(TokenType.OR)) {
      const operator = this.previous();
      const right = this.and();
      expr = {
        kind: 'LogicalExpression',
        left: expr,
        operator,
        right,
        start: expr.start,
        end: right.end,
        line: expr.line
      };
    }

    return expr;
  }

  private and(): AST.Expression {
    let expr = this.equality();

    while (this.match(TokenType.AND)) {
      const operator = this.previous();
      const right = this.equality();
      expr = {
        kind: 'LogicalExpression',
        left: expr,
        operator,
        right,
        start: expr.start,
        end: right.end,
        line: expr.line
      };
    }

    return expr;
  }

  private equality(): AST.Expression {
    let expr = this.comparison();

    while (this.match(TokenType.BANG_EQUAL, TokenType.EQUAL_EQUAL)) {
      const operator = this.previous();
      const right = this.comparison();
      expr = {
        kind: 'BinaryExpression',
        left: expr,
        operator,
        right,
        start: expr.start,
        end: right.end,
        line: expr.line
      };
    }

    return expr;
  }

  private comparison(): AST.Expression {
    let expr = this.term();

    while (this.match(TokenType.GREATER, TokenType.GREATER_EQUAL, TokenType.LESS, TokenType.LESS_EQUAL)) {
      const operator = this.previous();
      const right = this.term();
      expr = {
        kind: 'BinaryExpression',
        left: expr,
        operator,
        right,
        start: expr.start,
        end: right.end,
        line: expr.line
      };
    }

    return expr;
  }

  private term(): AST.Expression {
    let expr = this.factor();

    while (this.match(TokenType.MINUS, TokenType.PLUS)) {
      const operator = this.previous();
      const right = this.factor();
      expr = {
        kind: 'BinaryExpression',
        left: expr,
        operator,
        right,
        start: expr.start,
        end: right.end,
        line: expr.line
      };
    }

    return expr;
  }

  private factor(): AST.Expression {
    let expr = this.unary();

    while (this.match(TokenType.SLASH, TokenType.STAR, TokenType.PERCENT)) {
      const operator = this.previous();
      const right = this.unary();
      expr = {
        kind: 'BinaryExpression',
        left: expr,
        operator,
        right,
        start: expr.start,
        end: right.end,
        line: expr.line
      };
    }

    return expr;
  }

  private unary(): AST.Expression {
    if (this.match(TokenType.BANG, TokenType.MINUS)) {
      const operator = this.previous();
      const operand = this.unary();
      return {
        kind: 'UnaryExpression',
        operator,
        operand,
        start: operator.start,
        end: operand.end,
        line: operator.line
      };
    }

    return this.subscript();
  }

  private subscript(): AST.Expression {
    return this.call();
  }

  private call(): AST.Expression {
    let expr = this.primary();

    while (true) {
      if (this.match(TokenType.LEFT_PAREN)) {
        expr = this.finishCall(expr);
      } else if (this.match(TokenType.DOT)) {
        const property = this.consume(TokenType.IDENTIFIER, 'Expected property name after .');
        expr = {
          kind: 'GetExpression',
          object: expr,
          property,
          start: expr.start,
          end: property.end,
          line: expr.line
        };
      } else if (this.match(TokenType.LEFT_BRACKET)) {
        const index = this.expression();
        this.consume(TokenType.RIGHT_BRACKET, 'Expected ] after index');
        expr = {
          kind: 'SubscriptExpression',
          object: expr,
          index,
          start: expr.start,
          end: this.previous().end,
          line: expr.line
        };
      } else {
        break;
      }
    }

    return expr;
  }

  private finishCall(callee: AST.Expression): AST.CallExpression {
    const args: AST.Expression[] = [];

    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        args.push(this.expression());
      } while (this.match(TokenType.COMMA));
    }

    const paren = this.consume(TokenType.RIGHT_PAREN, 'Expected ) after arguments');

    return {
      kind: 'CallExpression',
      callee,
      args,
      paren,
      start: callee.start,
      end: paren.end,
      line: callee.line
    };
  }

  private primary(): AST.Expression {
    // Lambda expression
    if (this.match(TokenType.FUN)) {
      return this.lambdaExpression();
    }

    if (this.match(TokenType.FALSE)) {
      const token = this.previous();
      return {
        kind: 'LiteralExpression',
        value: false,
        token,
        start: token.start,
        end: token.end,
        line: token.line
      };
    }

    if (this.match(TokenType.TRUE)) {
      const token = this.previous();
      return {
        kind: 'LiteralExpression',
        value: true,
        token,
        start: token.start,
        end: token.end,
        line: token.line
      };
    }

    if (this.match(TokenType.NIL)) {
      const token = this.previous();
      return {
        kind: 'LiteralExpression',
        value: null,
        token,
        start: token.start,
        end: token.end,
        line: token.line
      };
    }

    if (this.match(TokenType.NUMBER, TokenType.STRING)) {
      const token = this.previous();
      let value: any = token.lexeme;
      if (token.type === TokenType.NUMBER) {
        value = parseFloat(token.lexeme);
      } else if (token.type === TokenType.STRING) {
        // Remove quotes
        value = token.lexeme.substring(1, token.lexeme.length - 1);
      }
      return {
        kind: 'LiteralExpression',
        value,
        token,
        start: token.start,
        end: token.end,
        line: token.line
      };
    }

    if (this.match(TokenType.SUPER)) {
      const keyword = this.previous();
      this.consume(TokenType.DOT, 'Expected . after super');
      const method = this.consume(TokenType.IDENTIFIER, 'Expected superclass method name');
      return {
        kind: 'SuperExpression',
        keyword,
        method,
        start: keyword.start,
        end: method.end,
        line: keyword.line
      };
    }

    if (this.match(TokenType.THIS)) {
      const keyword = this.previous();
      return {
        kind: 'ThisExpression',
        keyword,
        start: keyword.start,
        end: keyword.end,
        line: keyword.line
      };
    }

    if (this.match(TokenType.IDENTIFIER)) {
      const name = this.previous();
      return {
        kind: 'IdentifierExpression',
        name,
        start: name.start,
        end: name.end,
        line: name.line
      };
    }

    if (this.match(TokenType.LEFT_PAREN)) {
      const expr = this.expression();
      this.consume(TokenType.RIGHT_PAREN, 'Expected ) after expression');
      return expr;
    }

    if (this.match(TokenType.LEFT_BRACKET)) {
      return this.listLiteral();
    }

    if (this.match(TokenType.LEFT_BRACE)) {
      return this.mapLiteral();
    }

    throw new Error(`Unexpected token: ${this.peek().lexeme}`);
  }

  private listLiteral(): AST.ListExpression {
    const start = this.previous().start;
    const elements: AST.Expression[] = [];

    if (!this.check(TokenType.RIGHT_BRACKET)) {
      do {
        if (this.check(TokenType.RIGHT_BRACKET)) break; // trailing comma
        elements.push(this.expression());
      } while (this.match(TokenType.COMMA));
    }

    const endBracket = this.consume(TokenType.RIGHT_BRACKET, 'Expected ] after list elements');

    return {
      kind: 'ListExpression',
      elements,
      start,
      end: endBracket.end,
      line: this.previous().line
    };
  }

  private mapLiteral(): AST.MapExpression {
    const start = this.previous().start;
    const entries: Array<{ key: AST.Expression; value: AST.Expression }> = [];

    if (!this.check(TokenType.RIGHT_BRACE)) {
      do {
        if (this.check(TokenType.RIGHT_BRACE)) break;

        const key = this.expression();
        this.consume(TokenType.COLON, 'Expected : after map key');
        const value = this.expression();

        entries.push({ key, value });
      } while (this.match(TokenType.COMMA));
    }

    const endBrace = this.consume(TokenType.RIGHT_BRACE, 'Expected } after map entries');

    return {
      kind: 'MapExpression',
      entries,
      start,
      end: endBrace.end,
      line: this.previous().line
    };
  }

  private lambdaExpression(): AST.LambdaExpression {
    const start = this.previous().start;

    this.consume(TokenType.LEFT_PAREN, 'Expected ( after fun');
    const params: Token[] = [];

    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        params.push(this.consume(TokenType.IDENTIFIER, 'Expected parameter name'));
      } while (this.match(TokenType.COMMA));
    }

    this.consume(TokenType.RIGHT_PAREN, 'Expected ) after parameters');
    this.consume(TokenType.LEFT_BRACE, 'Expected { before lambda body');

    const body = this.blockStatement();

    return {
      kind: 'LambdaExpression',
      params,
      body,
      start,
      end: body.end,
      line: this.previous().line
    };
  }

  // Helper methods
  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();

    // Record the error
    this.errors.push({
      message,
      token: this.peek()
    });

    throw new Error(`${message} at line ${this.peek().line}`);
  }

  private synchronize(): void {
    this.advance();

    while (!this.isAtEnd()) {
      if (this.previous().type === TokenType.SEMICOLON) return;

      switch (this.peek().type) {
        case TokenType.CLASS:
        case TokenType.FUN:
        case TokenType.VAR:
        case TokenType.FOR:
        case TokenType.IF:
        case TokenType.WHILE:
        case TokenType.PRINT:
        case TokenType.RETURN:
          return;
      }

      this.advance();
    }
  }
}
