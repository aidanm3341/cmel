package com.aidan.aph.nativeFunctions;

import com.aidan.aph.AphCallable;
import com.aidan.aph.Interpreter;
import com.aidan.aph.RuntimeError;
import com.aidan.aph.Token;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.List;

public class Input implements AphCallable {
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
