package com.aidan.cmel;

public class CmelInstance {
    private CmelClass klass;

    public CmelInstance(CmelClass klass) {
        this.klass = klass;
    }

    public String toString() {
        return klass.name + " instance";
    }
}
