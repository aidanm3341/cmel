package com.aidan.aph;

import java.util.List;

public abstract class Statement {
    interface Visitor<R> {
        R visitBlockStatement(Block statement);
        R visitExpressionStatementStatement(ExpressionStatement statement);
        R visitIfStatementStatement(IfStatement statement);
        R visitPrintStatement(Print statement);
        R visitVarStatement(Var statement);
        R visitWhileStatement(While statement);
        R visitFunctionStatement(Function statement);
    }

    abstract <R> R accept(Visitor<R> visitor);

    static class Block extends Statement {
        final List<Statement> statements;
        public Block(List<Statement> statements) {
            this.statements = statements;
        }

        @Override
        <R> R accept(Visitor<R> visitor) {
            return visitor.visitBlockStatement(this);
        }
    }
    static class ExpressionStatement extends Statement {
        final Expression expression;
        public ExpressionStatement(Expression expression) {
            this.expression = expression;
        }

        @Override
        <R> R accept(Visitor<R> visitor) {
            return visitor.visitExpressionStatementStatement(this);
        }
    }
    static class IfStatement extends Statement {
        final Expression condition;
        final  Statement thenBranch;
        final  Statement elseBranch;
        public IfStatement(Expression condition, Statement thenBranch, Statement elseBranch) {
            this.condition = condition;
            this.thenBranch = thenBranch;
            this.elseBranch = elseBranch;
        }

        @Override
        <R> R accept(Visitor<R> visitor) {
            return visitor.visitIfStatementStatement(this);
        }
    }
    static class Print extends Statement {
        final Expression expression;
        public Print(Expression expression) {
            this.expression = expression;
        }

        @Override
        <R> R accept(Visitor<R> visitor) {
            return visitor.visitPrintStatement(this);
        }
    }
    static class Var extends Statement {
        final Token name;
        final  Expression initializer;
        public Var(Token name, Expression initializer) {
            this.name = name;
            this.initializer = initializer;
        }

        @Override
        <R> R accept(Visitor<R> visitor) {
            return visitor.visitVarStatement(this);
        }
    }
    static class While extends Statement {
        final Expression condition;
        final  Statement body;
        public While(Expression condition, Statement body) {
            this.condition = condition;
            this.body = body;
        }

        @Override
        <R> R accept(Visitor<R> visitor) {
            return visitor.visitWhileStatement(this);
        }
    }
    static class Function extends Statement {
        final Token name;
        final  List<Token> parameters;
        final  List<Statement> body;
        public Function(Token name, List<Token> parameters, List<Statement> body) {
            this.name = name;
            this.parameters = parameters;
            this.body = body;
        }

        @Override
        <R> R accept(Visitor<R> visitor) {
            return visitor.visitFunctionStatement(this);
        }
    }
}