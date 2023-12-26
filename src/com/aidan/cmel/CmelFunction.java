package com.aidan.cmel;

import java.util.List;

public class CmelFunction implements CmelCallable {
    private final Statement.Function declaration;
    private final Environment closure;
    private final boolean isInitializer;

    public CmelFunction(Statement.Function declaration, Environment closure, boolean isInitializer) {
        this.declaration = declaration;
        this.closure = closure;
        this.isInitializer = isInitializer;
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
            if (isInitializer) return closure.getAt(0, "this");

            return returnValue.getValue();
        }

        if (isInitializer) return closure.getAt(0, "this");
        return null;
    }

    public CmelFunction bind(CmelInstance instance) {
        Environment environment = new Environment(closure);
        environment.define("this", instance);
        return new CmelFunction(declaration, environment, isInitializer);
    }

    @Override
    public int arity() {
        return declaration.parameters.size();
    }

    @Override
    public String toString() {
        return "<fn " + declaration.name.getLexeme() + ">";
    }
}
