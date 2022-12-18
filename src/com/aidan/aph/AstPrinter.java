package com.aidan.aph;

public class AstPrinter implements Expression.Visitor<String> {

    public String print(Expression expression) {
        return expression.accept(this);
    }

    @Override
    public String visitAssignExpression(Expression.Assign expression) {
        return parenthesize("assign", expression);
    }

    @Override
    public String visitBinaryExpression(Expression.Binary expression) {
        return parenthesize(expression.operator.getLexeme(), expression.left, expression.right);
    }

    @Override
    public String visitLogicalExpression(Expression.Logical expression) {
        return parenthesize(expression.operator.getLexeme(), expression.left, expression.right);
    }

    @Override
    public String visitGroupingExpression(Expression.Grouping expression) {
        return parenthesize("group", expression.expression);
    }

    @Override
    public String visitLiteralExpression(Expression.Literal expression) {
        if (expression.value == null) return "nil";
        return expression.value.toString();
    }

    @Override
    public String visitUnaryExpression(Expression.Unary expression) {
        return parenthesize(expression.operator.getLexeme(), expression.right);
    }

    @Override
    public String visitCallExpression(Expression.Call expression) {
        return parenthesize("call", expression);
    }

    @Override
    public String visitTernaryExpression(Expression.Ternary expression) {
        return parenthesize("ternary", expression.left, expression.left, expression.right);
    }

    @Override
    public String visitVariableExpression(Expression.Variable expression) {
        return parenthesize("var", expression);
    }

    private String parenthesize(String name, Expression... expressions) {
        StringBuilder builder = new StringBuilder();
        builder.append('(').append(name);
        for (Expression expr : expressions) {
            builder.append(' ');
            builder.append(expr.accept(this));
        }
        builder.append(')');

        return builder.toString();
    }
}
