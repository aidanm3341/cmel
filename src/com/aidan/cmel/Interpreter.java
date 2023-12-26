package com.aidan.cmel;

import com.aidan.cmel.nativeFunctions.Clock;
import com.aidan.cmel.nativeFunctions.Input;
import com.aidan.cmel.nativeFunctions.Print;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Interpreter implements Expression.Visitor<Object>, Statement.Visitor<Void> {

    private Environment globals = new Environment();
    private Environment environment = globals;
    private Map<Expression, Integer> locals;

    public Interpreter() {
        locals = new HashMap<>();
        globals.define("clock", new Clock());
        globals.define("print", new Print());
        globals.define("input", new Input());
    }

    public void interpret(List<Statement> statements) {
        try {
            for (Statement statement : statements) {
                execute(statement);
            }
        } catch (RuntimeError error) {
            Cmel.runtimeError(error);
        }
    }

    private String stringify(Object value) {
        if (value == null) return "nil";

        if (value instanceof Double) {
            String text = value.toString();
            if (text.endsWith(".0"))
                text = text.substring(0, text.length()-2);
            return text;
        }

        return value.toString();
    }


    @Override
    public Object visitAssignExpression(Expression.Assign expression) {
        Object value = evaluate(expression.value);

        Integer distance = locals.get(expression);
        if (distance != null)
            environment.assignAt(distance, expression.name, value);
        else
            globals.assign(expression.name, value);

        return value;
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
    public Object visitLogicalExpression(Expression.Logical expression) {
        Object left = evaluate(expression.left);

        if (expression.operator.getType() == TokenType.OR) {
            if (isTruthy(left)) return left;
        } else {
            if (!isTruthy(left)) return left;
        }

        return evaluate(expression.right);
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
    public Object visitCallExpression(Expression.Call expression) {
        Object callee = evaluate(expression.callee);

        List<Object> arguments = new ArrayList<>();
        for (Expression argument : expression.arguments)
            arguments.add(evaluate(argument));

        if (!(callee instanceof CmelCallable))
            throw new RuntimeError(expression.paren, "Can only call functions and classes");

        CmelCallable function = (CmelCallable) callee;

        if (arguments.size() != function.arity())
            throw new RuntimeError(expression.paren, "Expected " + function.arity() + " arguments, but got " + arguments.size() + " instead.");
        return function.call(this, arguments);
    }

    @Override
    public Object visitTernaryExpression(Expression.Ternary expression) {
        Object test = evaluate(expression.test);
        Object left = evaluate(expression.left);
        Object right = evaluate(expression.right);

        return isTruthy(test) ? left : right;
    }

    @Override
    public Object visitVariableExpression(Expression.Variable expression) {
        return lookupVariable(expression.name, expression);
    }

    private Object lookupVariable(Token name, Expression expression) {
        Integer distance = locals.get(expression);
        if (distance != null)
            return environment.getAt(distance, name.getLexeme());
        else
            return globals.get(name);
    }

    @Override
    public Object visitAnonFunctionExpression(Expression.AnonFunction expression) {
        return new CmelAnonFunction(expression, environment);
    }

    @Override
    public Void visitBlockStatement(Statement.Block statement) {
        executeBlock(statement.statements, new Environment(environment));
        return null;
    }

    @Override
    public Void visitClassStatement(Statement.Class statement) {
        environment.define(statement.name.getLexeme(), null);
        CmelClass klass = new CmelClass(statement.name.getLexeme());
        environment.assign(statement.name, klass);
        return null;
    }

    @Override
    public Void visitExpressionStatementStatement(Statement.ExpressionStatement statement) {
        evaluate(statement.expression);
        return null;
    }

    @Override
    public Void visitIfStatementStatement(Statement.IfStatement statement) {
        if (isTruthy(evaluate(statement.condition)))
            execute(statement.thenBranch);
        else if (statement.elseBranch != null)
            execute(statement.elseBranch);
        return null;
    }

    @Override
    public Void visitVarStatement(Statement.Var statement) {
        Object value = null;
        if (statement.initializer != null)
            value = evaluate(statement.initializer);

        environment.define(statement.name.getLexeme(), value);
        return null;
    }

    @Override
    public Void visitWhileStatement(Statement.While statement) {
        while (isTruthy(evaluate(statement.condition))) {
            execute(statement.body);
        }
        return null;
    }

    @Override
    public Void visitFunctionStatement(Statement.Function statement) {
        CmelFunction function = new CmelFunction(statement, environment);
        environment.define(statement.name.getLexeme(), function);
        return null;
    }

    @Override
    public Void visitReturnStatement(Statement.Return statement) {
        Object value = null;
        if (statement.value != null) value = evaluate(statement.value);

        throw new Return(value);
    }

    @Override
    public Object visitGetExpression(Expression.Get expression) {
        Object object = evaluate(expression.object);
        if (object instanceof CmelInstance) {
            return ((CmelInstance) object).get(expression.name);
        }

        throw new RuntimeError(expression.name, "Only instances have properties");
    }

    @Override
    public Object visitSetExpression(Expression.Set expression) {
        Object object = evaluate(expression.object);

        if (!(object instanceof CmelInstance)) {
            throw new RuntimeError(expression.name, "Only instances have fields.");
        }

        Object value = evaluate(expression.value);
        ((CmelInstance) object).set(expression.name, value);
        return value;
    }

    private void checkNumberOperand(Token operator, Object operand) {
        if (operand instanceof Double) return;
        throw new RuntimeError(operator, "Operand must be a number.");
    }

    private void checkNumberOperands(Token operator, Object left, Object right) {
        if (left instanceof Double && right instanceof Double) return;
        throw new RuntimeError(operator, "Operands must be numbers.");
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

    private void execute(Statement statement) {
        statement.accept(this);
    }

    public void executeBlock(List<Statement> statements, Environment environment) {
        Environment previous = this.environment;
        try {
            this.environment = environment;
            for (Statement statement : statements)
                execute(statement);
        } finally {
            this.environment = previous;
        }
    }

    public Environment getGlobals() {
        return globals;
    }

    public void resolve(Expression expression, int depth) {
        locals.put(expression, depth);
    }
}
