package com.aidan.cmel.nativeFunctions;

import com.aidan.cmel.CmelCallable;
import com.aidan.cmel.Interpreter;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.List;

public class Input implements CmelCallable {
    @Override
    public Object call(Interpreter interpreter, List<Object> arguments) {
        InputStreamReader inputStreamReader = new InputStreamReader(System.in);
        BufferedReader reader = new BufferedReader(inputStreamReader);
        try {
            String input = reader.readLine();
            if (isNumeric(input))
                return Double.parseDouble(input);
            else
                return input;
        } catch (IOException e) {
            return "";
        }
    }

    @Override
    public int arity() {
        return 0;
    }

    @Override
    public String toString() {
        return "<native fn>";
    }

    public static boolean isNumeric(String strNum) {
        if (strNum == null) {
            return false;
        }
        try {
            double d = Double.parseDouble(strNum);
        } catch (NumberFormatException nfe) {
            return false;
        }
        return true;
    }
}
