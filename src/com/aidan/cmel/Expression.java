package com.aidan.cmel;

import java.util.List;

public abstract class Expression {
    interface Visitor<R> {
        R visitAssignExpression(Assign expression);
        R visitTernaryExpression(Ternary expression);
        R visitBinaryExpression(Binary expression);
        R visitLogicalExpression(Logical expression);
        R visitGroupingExpression(Grouping expression);
        R visitLiteralExpression(Literal expression);
        R visitUnaryExpression(Unary expression);
        R visitCallExpression(Call expression);
        R visitVariableExpression(Variable expression);
        R visitAnonFunctionExpression(AnonFunction expression);
    }

    abstract <R> R accept(Visitor<R> visitor);

    static class Assign extends Expression {
        final Token name;
        final  Expression value;
        public Assign(Token name, Expression value) {
            this.name = name;
            this.value = value;
        }

        @Override
        <R> R accept(Visitor<R> visitor) {
            return visitor.visitAssignExpression(this);
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
    static class Logical extends Expression {
        final Expression left;
        final  Token operator;
        final  Expression right;
        public Logical(Expression left, Token operator, Expression right) {
            this.left = left;
            this.operator = operator;
            this.right = right;
        }

        @Override
        <R> R accept(Visitor<R> visitor) {
            return visitor.visitLogicalExpression(this);
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
    static class Call extends Expression {
        final Expression callee;
        final  Token paren;
        final  List<Expression> arguments;
        public Call(Expression callee, Token paren, List<Expression> arguments) {
            this.callee = callee;
            this.paren = paren;
            this.arguments = arguments;
        }

        @Override
        <R> R accept(Visitor<R> visitor) {
            return visitor.visitCallExpression(this);
        }
    }
    static class Variable extends Expression {
        final Token name;
        public Variable(Token name) {
            this.name = name;
        }

        @Override
        <R> R accept(Visitor<R> visitor) {
            return visitor.visitVariableExpression(this);
        }
    }
    static class AnonFunction extends Expression {
        final List<Token> parameters;
        final  List<Statement> body;
        public AnonFunction(List<Token> parameters, List<Statement> body) {
            this.parameters = parameters;
            this.body = body;
        }

        @Override
        <R> R accept(Visitor<R> visitor) {
            return visitor.visitAnonFunctionExpression(this);
        }
    }
}