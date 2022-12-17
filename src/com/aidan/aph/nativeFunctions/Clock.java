package com.aidan.aph.nativeFunctions;

import com.aidan.aph.AphCallable;
import com.aidan.aph.Interpreter;

import java.util.List;

public class Clock implements AphCallable {
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
