package com.aidan.cmel;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Stack;

public class Resolver implements Expression.Visitor<Void>, Statement.Visitor<Void> {

    private enum FunctionType {
        NONE, FUNCTION, METHOD, INITIALIZER
    }

    private enum ClassType {
        NONE, CLASS, SUBCLASS
    }

    private ClassType currentClass = ClassType.NONE;

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
    public Void visitSetExpression(Expression.Set expression) {
        resolve(expression.value);
        resolve(expression.object);
        return null;
    }

    @Override
    public Void visitSuperExpression(Expression.Super expression) {
        if (currentClass == ClassType.NONE) {
            Cmel.error(expression.keyword, "Can't use 'super' outside of a class.");
        } else if (currentClass != ClassType.SUBCLASS) {
            Cmel.error(expression.keyword, "Can't use 'super' in a class with no superclass.");
        }
        resolveLocal(expression, expression.keyword);
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
            Cmel.error(expression.name, "Can't read local variable in it's own initializer;");

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

    @Override
    public Void visitClassStatement(Statement.Class statement) {
        ClassType enclosingClass = currentClass;
        currentClass = ClassType.CLASS;

        declare(statement.name);
        define(statement.name);

        if (statement.superclass != null && statement.superclass.name.getLexeme().equals(statement.name.getLexeme())) {
            Cmel.error(statement.superclass.name, "A class can't inherit from itself.");
        }

        if (statement.superclass != null) {
            currentClass = ClassType.SUBCLASS;
            resolve(statement.superclass);
        }

        if (statement.superclass != null) {
            beginScope();
            scopes.peek().put("super", true);
        }

        beginScope();
        scopes.peek().put("this", true);

        for (Statement.Function method : statement.methods) {
            FunctionType declaration = FunctionType.METHOD;
            if (method.name.getLexeme().equals("init"))
                declaration = FunctionType.INITIALIZER;

            resolveFunction(method, declaration);
        }

        endScope();

        if (statement.superclass != null)
            endScope();

        currentClass = enclosingClass;
        return null;
    }

    @Override
    public Void visitGetExpression(Expression.Get expression) {
        resolve(expression.object);
        return null;
    }

    @Override
    public Void visitThisExpression(Expression.This expression) {
        if (currentClass == ClassType.NONE) {
            Cmel.error(expression.keyword, "Can't use 'this' outside of a class.");
            return null;
        }

        resolveLocal(expression, expression.keyword);
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
            Cmel.error(name, "There is already a variable with this name in scope.");
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
            Cmel.error(statement.keyword, "Can't return outside of a function.");
        if (statement.value != null) {
            if (currentFunction == FunctionType.INITIALIZER) {
                Cmel.error(statement.keyword, "Can't return a value from an initializer.");
            }
            resolve(statement.value);
        }
        return null;
    }
}
