package com.aidan.cmel;

import java.util.List;
import java.util.Map;

public class CmelClass implements CmelCallable {
    final String name;
    final Map<String, CmelFunction> methods;

    public CmelClass(String name, Map<String, CmelFunction> methods) {
        this.name = name;
        this.methods = methods;
    }

    public CmelFunction findMethod(String name) {
        if (methods.containsKey(name)) {
            return methods.get(name);
        }

        return null;
    }

    @Override
    public Object call(Interpreter interpreter, List<Object> arguments) {
        CmelInstance instance = new CmelInstance(this);
        CmelFunction initializer = findMethod("init");
        if (initializer != null) {
            initializer.bind(instance).call(interpreter, arguments);
        }

        return instance;
    }

    @Override
    public int arity() {
        CmelFunction initializer = findMethod("init");
        if (initializer == null) return 0;
        return initializer.arity();
    }

    @Override
    public String toString() {
        return name;
    }
}
