package com.aidan.aph;

import java.util.List;

public abstract class Expression {
    static class Binary extends Expression {
        final Expression left;
        final  Token operator;
        final  Expression right;
        public Binary(Expression left, Token operator, Expression right) {
            this.left = left;
            this.operator = operator;
            this.right = right;
        }
    }
    static class Grouping extends Expression {
        final Expression expression;
        public Grouping(Expression expression) {
            this.expression = expression;
        }
    }
    static class Literal extends Expression {
        final Object value;
        public Literal(Object value) {
            this.value = value;
        }
    }
    static class Unary extends Expression {
        final Token operator;
        final  Expression right;
        public Unary(Token operator, Expression right) {
            this.operator = operator;
            this.right = right;
        }
    }
}