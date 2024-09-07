package com.aidan.cmel;

import java.util.List;

public interface CmelCallable {
    Object call(Interpreter interpreter, List<Object> arguments);
    int arity();
}
