package com.aidan.aph;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Stack;

public class Resolver implements Expression.Visitor<Void>, Statement.Visitor<Void> {

    private enum FunctionType {
        NONE, FUNCTION
    }

    private final Interpreter interpreter;
    private final Stack<Map<String, Boolean>> scopes;
    private FunctionType currentFunction = FunctionType.NONE;

    public Resolver(Interpreter interpreter) {
        this.interpreter = interpreter;
        scopes = new Stack<>();
    }

    @Override
    public Void visitAssignExpression(Expression.Assign expression) {
        resolve(expression.value);
        resolveLocal(expression, expression.name);
        return null;
    }

    @Override
    public Void visitTernaryExpression(Expression.Ternary expression) {
        resolve(expression.test);
        resolve(expression.left);
        resolve(expression.right);
        return null;
    }

    @Override
    public Void visitBinaryExpression(Expression.Binary expression) {
        resolve(expression.left);
        resolve(expression.right);
        return null;
    }

    @Override
    public Void visitLogicalExpression(Expression.Logical expression) {
        resolve(expression.left);
        resolve(expression.right);
        return null;
    }

    @Override
    public Void visitGroupingExpression(Expression.Grouping expression) {
        resolve(expression.expression);
        return null;
    }

    @Override
    public Void visitLiteralExpression(Expression.Literal expression) {
        return null;
    }

    @Override
    public Void visitUnaryExpression(Expression.Unary expression) {
        resolve(expression.right);
        return null;
    }

    @Override
    public Void visitCallExpression(Expression.Call expression) {
        resolve(expression.callee);

        for (Expression arg : expression.arguments)
            resolve(arg);
        return null;
    }

    @Override
    public Void visitVariableExpression(Expression.Variable expression) {
        if (!scopes.isEmpty() && scopes.peek().get(expression.name.getLexeme()) == Boolean.FALSE)
            Aph.error(expression.name, "Can't read local variable in it's own initializer;");

        resolveLocal(expression, expression.name);
        return null;
    }

    private void resolveLocal(Expression expression, Token name) {
        for (int i = scopes.size() - 1; i >= 0; i--) {
            if (scopes.get(i).containsKey(name.getLexeme())) {
                interpreter.resolve(expression, scopes.size() - 1 - i);
                return;
            }
        }
    }

    @Override
    public Void visitAnonFunctionExpression(Expression.AnonFunction expression) {
        resolveAnonFunction(expression, FunctionType.FUNCTION);
        return null;
    }

    @Override
    public Void visitBlockStatement(Statement.Block statement) {
        beginScope();
        resolve(statement.statements);
        endScope();
        return null;
    }

    private void beginScope() {
        scopes.push(new HashMap<>());
    }

    private void endScope() {
        scopes.pop();
    }

    public void resolve(List<Statement> statements) {
        for (Statement statement : statements)
            resolve(statement);
    }

    private void resolve(Statement statement) {
        statement.accept(this);
    }

    private void resolve(Expression expression) {
        expression.accept(this);
    }

    @Override
    public Void visitExpressionStatementStatement(Statement.ExpressionStatement statement) {
        resolve(statement.expression);
        return null;
    }

    @Override
    public Void visitIfStatementStatement(Statement.IfStatement statement) {
        resolve(statement.condition);
        resolve(statement.thenBranch);
        if (statement.elseBranch != null) resolve(statement.elseBranch);
        return null;
    }

    @Override
    public Void visitVarStatement(Statement.Var statement) {
        declare(statement.name);
        if (statement.initializer != null)
            resolve(statement.initializer);
        define(statement.name);

        return null;
    }

    private void declare(Token name) {
        if (scopes.isEmpty()) return;
        Map<String, Boolean> scope = scopes.peek();
        if (scope.containsKey(name.getLexeme()))
            Aph.error(name, "There is already a variable with this name in scope.");
        scope.put(name.getLexeme(), false);
    }

    private void define(Token name) {
        if (scopes.isEmpty()) return;
        scopes.peek().put(name.getLexeme(), true);
    }

    @Override
    public Void visitWhileStatement(Statement.While statement) {
        resolve(statement.condition);
        resolve(statement.body);
        return null;
    }

    @Override
    public Void visitFunctionStatement(Statement.Function statement) {
        declare(statement.name);
        define(statement.name);

        resolveFunction(statement, FunctionType.FUNCTION);
        return null;
    }

    private void resolveFunction(Statement.Function function, FunctionType type) {
        FunctionType enclosingFunction = currentFunction;
        currentFunction = type;

        beginScope();
        for (Token param : function.parameters) {
            declare(param);
            define(param);
        }
        resolve(function.body);
        endScope();
        currentFunction = enclosingFunction;
    }

    private void resolveAnonFunction(Expression.AnonFunction function, FunctionType type) {
        FunctionType enclosingFunction = currentFunction;
        currentFunction = type;

        beginScope();
        for (Token param : function.parameters) {
            declare(param);
            define(param);
        }
        resolve(function.body);
        endScope();
        currentFunction = enclosingFunction;
    }

    @Override
    public Void visitReturnStatement(Statement.Return statement) {
        if (currentFunction == FunctionType.NONE)
            Aph.error(statement.keyword, "Can't return outside of a function.");
        if (statement.value != null) resolve(statement.value);
        return null;
    }
}
