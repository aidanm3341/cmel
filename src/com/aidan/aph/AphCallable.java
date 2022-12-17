package com.aidan.aph;

import java.util.List;

public interface AphCallable {
    Object call(Interpreter interpreter, List<Object> arguments);
    int arity();
}
