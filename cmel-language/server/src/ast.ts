// AST node definitions for Cmel

import { Token } from './scanner';

export interface ASTNode {
  kind: string;
  start: number;
  end: number;
  line: number;
}

// Statements
export interface Program extends ASTNode {
  kind: 'Program';
  body: Statement[];
}

export type Statement =
  | VarDeclaration
  | FunDeclaration
  | ClassDeclaration
  | ExpressionStatement
  | PrintStatement
  | IfStatement
  | WhileStatement
  | ForStatement
  | ReturnStatement
  | BreakStatement
  | BlockStatement
  | ImportStatement;

export interface VarDeclaration extends ASTNode {
  kind: 'VarDeclaration';
  name: Token;
  isConst: boolean;
  isExport: boolean;
  initializer: Expression | null;
}

export interface FunDeclaration extends ASTNode {
  kind: 'FunDeclaration';
  name: Token;
  params: Token[];
  body: BlockStatement;
  isExport: boolean;
}

export interface ClassDeclaration extends ASTNode {
  kind: 'ClassDeclaration';
  name: Token;
  superclass: Token | null;
  methods: FunDeclaration[];
}

export interface ExpressionStatement extends ASTNode {
  kind: 'ExpressionStatement';
  expression: Expression;
}

export interface PrintStatement extends ASTNode {
  kind: 'PrintStatement';
  expression: Expression;
}

export interface IfStatement extends ASTNode {
  kind: 'IfStatement';
  condition: Expression;
  thenBranch: Statement;
  elseBranch: Statement | null;
}

export interface WhileStatement extends ASTNode {
  kind: 'WhileStatement';
  condition: Expression;
  body: Statement;
}

export interface ForStatement extends ASTNode {
  kind: 'ForStatement';
  initializer: Statement | null;
  condition: Expression | null;
  increment: Expression | null;
  body: Statement;
}

export interface ReturnStatement extends ASTNode {
  kind: 'ReturnStatement';
  value: Expression | null;
}

export interface BreakStatement extends ASTNode {
  kind: 'BreakStatement';
}

export interface BlockStatement extends ASTNode {
  kind: 'BlockStatement';
  statements: Statement[];
}

export interface ImportStatement extends ASTNode {
  kind: 'ImportStatement';
  path: Token;
  imports: Token[];  // specific imports after 'from'
}

// Expressions
export type Expression =
  | BinaryExpression
  | UnaryExpression
  | LiteralExpression
  | IdentifierExpression
  | AssignmentExpression
  | CallExpression
  | GetExpression
  | SetExpression
  | ThisExpression
  | SuperExpression
  | ListExpression
  | MapExpression
  | SubscriptExpression
  | LogicalExpression;

export interface BinaryExpression extends ASTNode {
  kind: 'BinaryExpression';
  left: Expression;
  operator: Token;
  right: Expression;
}

export interface UnaryExpression extends ASTNode {
  kind: 'UnaryExpression';
  operator: Token;
  operand: Expression;
}

export interface LiteralExpression extends ASTNode {
  kind: 'LiteralExpression';
  value: any;
  token: Token;
}

export interface IdentifierExpression extends ASTNode {
  kind: 'IdentifierExpression';
  name: Token;
}

export interface AssignmentExpression extends ASTNode {
  kind: 'AssignmentExpression';
  target: Token;
  value: Expression;
}

export interface CallExpression extends ASTNode {
  kind: 'CallExpression';
  callee: Expression;
  args: Expression[];
  paren: Token;
}

export interface GetExpression extends ASTNode {
  kind: 'GetExpression';
  object: Expression;
  property: Token;
}

export interface SetExpression extends ASTNode {
  kind: 'SetExpression';
  object: Expression;
  property: Token;
  value: Expression;
}

export interface ThisExpression extends ASTNode {
  kind: 'ThisExpression';
  keyword: Token;
}

export interface SuperExpression extends ASTNode {
  kind: 'SuperExpression';
  keyword: Token;
  method: Token;
}

export interface ListExpression extends ASTNode {
  kind: 'ListExpression';
  elements: Expression[];
}

export interface MapExpression extends ASTNode {
  kind: 'MapExpression';
  entries: Array<{ key: Expression; value: Expression }>;
}

export interface SubscriptExpression extends ASTNode {
  kind: 'SubscriptExpression';
  object: Expression;
  index: Expression;
}

export interface LogicalExpression extends ASTNode {
  kind: 'LogicalExpression';
  left: Expression;
  operator: Token;
  right: Expression;
}
