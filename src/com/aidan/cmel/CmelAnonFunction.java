package com.aidan.cmel;

import java.util.List;

public class CmelAnonFunction implements CmelCallable {
    private final Expression.AnonFunction declaration;
    private final Environment closure;

    public CmelAnonFunction(Expression.AnonFunction declaration, Environment closure) {
        this.declaration = declaration;
        this.closure = closure;
    }
    @Override
    public Object call(Interpreter interpreter, List<Object> arguments) {
        Environment environment = new Environment(closure);
        for (int i = 0; i < declaration.parameters.size(); i++) {
            environment.define(declaration.parameters.get(i).getLexeme(), arguments.get(i));
        }

        try {
            interpreter.executeBlock(declaration.body, environment);
        } catch (Return returnValue) {
            return returnValue.getValue();
        }

        return null;
    }

    @Override
    public int arity() {
        return declaration.parameters.size();
    }

    @Override
    public String toString() {
        return "<fn anon>";
    }
}
