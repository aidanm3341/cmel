package com.aidan.aph;

import java.util.List;

public abstract class Statement {
    interface Visitor<R> {
        R visitExpressionStatementStatement(ExpressionStatement statement);
        R visitPrintStatement(Print statement);
        R visitVarStatement(Var statement);
    }

    abstract <R> R accept(Visitor<R> visitor);

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
}