package com.aidan.cmel.nativeFunctions;

import com.aidan.cmel.CmelCallable;
import com.aidan.cmel.Interpreter;

import java.util.List;

public class Print implements CmelCallable {
    @Override
    public Object call(Interpreter interpreter, List<Object> arguments) {
        System.out.println(stringify(arguments.get(0)));
        return null;
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
    public int arity() {
        return 1;
    }

    @Override
    public String toString() {
        return "<native fn>";
    }
}
