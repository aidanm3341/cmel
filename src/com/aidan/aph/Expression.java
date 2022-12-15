package com.aidan.aph;

import java.util.List;

public abstract class Expression {
    interface Visitor<R> {
        R visitBinaryExpression(Binary expression);
        R visitGroupingExpression(Grouping expression);
        R visitLiteralExpression(Literal expression);
        R visitUnaryExpression(Unary expression);
        R visitTernaryExpression(Ternary expression);
    }

    abstract <R> R accept(Visitor<R> visitor);

    static class Binary extends Expression {
        final Expression left;
        final  Token operator;
        final  Expression right;
        public Binary(Expression left, Token operator, Expression right) {
            this.left = left;
            this.operator = operator;
            this.right = right;
        }

        @Override
        <R> R accept(Visitor<R> visitor) {
            return visitor.visitBinaryExpression(this);
        }
    }
    static class Grouping extends Expression {
        final Expression expression;
        public Grouping(Expression expression) {
            this.expression = expression;
        }

        @Override
        <R> R accept(Visitor<R> visitor) {
            return visitor.visitGroupingExpression(this);
        }
    }
    static class Literal extends Expression {
        final Object value;
        public Literal(Object value) {
            this.value = value;
        }

        @Override
        <R> R accept(Visitor<R> visitor) {
            return visitor.visitLiteralExpression(this);
        }
    }
    static class Unary extends Expression {
        final Token operator;
        final  Expression right;
        public Unary(Token operator, Expression right) {
            this.operator = operator;
            this.right = right;
        }

        @Override
        <R> R accept(Visitor<R> visitor) {
            return visitor.visitUnaryExpression(this);
        }
    }
    static class Ternary extends Expression {
        final Expression test;
        final  Token question;
        final  Expression left;
        final  Token colon;
        final  Expression right;
        public Ternary(Expression test, Token question, Expression left, Token colon, Expression right) {
            this.test = test;
            this.question = question;
            this.left = left;
            this.colon = colon;
            this.right = right;
        }

        @Override
        <R> R accept(Visitor<R> visitor) {
            return visitor.visitTernaryExpression(this);
        }
    }
}