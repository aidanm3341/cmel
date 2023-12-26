package com.aidan.cmel;

import java.util.HashMap;
import java.util.Map;

public class CmelInstance {
    private CmelClass klass;

    private final Map<String, Object> fields = new HashMap<>();

    public CmelInstance(CmelClass klass) {
        this.klass = klass;
    }

    public Object get(Token name) {
        if (fields.containsKey(name.getLexeme()))
            return fields.get(name.getLexeme());

        throw new RuntimeError(name, "Undefined property '" + name.getLexeme() + "'.");
    }

    public void set(Token name, Object value) {
        fields.put(name.getLexeme(), value);
    }

    public String toString() {
        return klass.name + " instance";
    }
}
