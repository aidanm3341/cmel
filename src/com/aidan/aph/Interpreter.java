package com.aidan.aph;

public class Interpreter implements Expression.Visitor<Object> {

    public void interpret(Expression expression) {
        try {
            Object value = evaluate(expression);
            System.out.println(stringify(value));
        } catch (RuntimeError error) {
            Aph.runtimeError(error);
        }
    }

    private String stringify(Object value) {
        if (value == null) return "null";

        if (value instanceof Double) {
            String text = value.toString();
            if (text.endsWith(".0"))
                text = text.substring(0, text.length()-2);
            return text;
        }

        return value.toString();
    }


    @Override
    public Object visitBinaryExpression(Expression.Binary expression) {
        Object left = evaluate(expression.left);
        Object right = evaluate(expression.right);

        switch (expression.operator.getType()) {
            case GREATER -> {
                checkNumberOperands(expression.operator, left, right);
                return (double)left > (double)right;
            }
            case GREATER_EQUAL -> {
                checkNumberOperands(expression.operator, left, right);
                return (double)left >= (double)right;
            }
            case LESS -> {
                checkNumberOperands(expression.operator, left, right);
                return (double)left < (double)right;
            }
            case LESS_EQUAL -> {
                checkNumberOperands(expression.operator, left, right);
                return (double)left <= (double)right;
            }

            case BANG_EQUAL -> { return !isEqual(left, right); }
            case EQUAL_EQUAL -> { return isEqual(left, right); }

            case MINUS -> {
                checkNumberOperands(expression.operator, left, right);
                return (double)left - (double)right;
            }
            case SLASH -> {
                checkNumberOperands(expression.operator, left, right);
                if ((double) right == 0)
                    throw new RuntimeError(expression.operator, "Cannot divide by zero.");
                return (double)left / (double)right;
            }
            case STAR  -> {
                checkNumberOperands(expression.operator, left, right);
                return (double)left * (double)right;
            }
            case PLUS -> {
                if (left instanceof Double l && right instanceof Double r)
                    return l + r;
                if (left instanceof String l && right instanceof String r)
                    return l + r;
                if (left instanceof String l && right instanceof Double r)
                    return l + stringify(r);
                if (left instanceof Double l && right instanceof String r)
                    return stringify(l) + r;

                throw new RuntimeError(expression.operator, "Operands must be numbers or strings.");
            }
        }
        return null;
    }

    @Override
    public Object visitGroupingExpression(Expression.Grouping expression) {
        return evaluate(expression.expression);
    }

    @Override
    public Object visitLiteralExpression(Expression.Literal expression) {
        return expression.value;
    }

    @Override
    public Object visitUnaryExpression(Expression.Unary expression) {
        Object right = evaluate(expression.right);

        switch (expression.operator.getType()) {
            case MINUS -> {
                checkNumberOperand(expression.operator, right);
                return -(double) right;
            }
            case BANG -> { return !isTruthy(right); }
        }

        // unreachable
        return null;
    }

    @Override
    public Object visitTernaryExpression(Expression.Ternary expression) {
        Object test = evaluate(expression.test);
        Object left = evaluate(expression.left);
        Object right = evaluate(expression.right);

        return isTruthy(test) ? left : right;
    }

    private void checkNumberOperand(Token operator, Object operand) {
        if (operand instanceof Double) return;
        throw new RuntimeError(operator, "Operand must be a number.");
    }

    private void checkNumberOperands(Token operator, Object left, Object right) {
        if (left instanceof Double && right instanceof Double) return;
        throw new RuntimeError(operator, "Operands must be a numbers.");
    }

    private boolean isEqual(Object left, Object right) {
        if (left == null && right == null) return true;
        if (left == null) return false;

        return left.equals(right);
    }

    private boolean isTruthy(Object object) {
        if (object == null) return false;
        if (object instanceof Boolean) return (boolean)object;
        return true;
    }

    private Object evaluate(Expression expression) {
        return expression.accept(this);
    }
}
