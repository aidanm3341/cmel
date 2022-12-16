package com.aidan.aph;

import java.util.List;

public abstract class Statement {
    interface Visitor<R> {
        R visitExpressionStatementStatement(ExpressionStatement statement);
        R visitPrintStatement(Print statement);
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
}