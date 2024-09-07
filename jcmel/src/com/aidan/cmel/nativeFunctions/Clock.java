package com.aidan.cmel.nativeFunctions;

import com.aidan.cmel.CmelCallable;
import com.aidan.cmel.Interpreter;

import java.util.List;

public class Clock implements CmelCallable {
    @Override
    public Object call(Interpreter interpreter, List<Object> arguments) {
        return (double)System.currentTimeMillis() / 1000;
    }

    @Override
    public int arity() {
        return 0;
    }

    @Override
    public String toString() {
        return "<native fn>";
    }
}
