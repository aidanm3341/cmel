package com.aidan.cmel;

import java.util.List;

public class CmelClass implements CmelCallable {
    final String name;

    public CmelClass(String name) {
        this.name = name;
    }

    @Override
    public String toString() {
        return name;
    }

    @Override
    public Object call(Interpreter interpreter, List<Object> arguments) {
        CmelInstance instance = new CmelInstance(this);
        return instance;
    }

    @Override
    public int arity() {
        return 0;
    }
}
