package com.aidan.aph;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;

import static com.aidan.aph.TokenType.EOF;
import static java.lang.Thread.sleep;

public class Aph {
    private static boolean hadError;
    private static boolean hadRuntimeError;

    private static Interpreter interpreter = new Interpreter();

    public static void main(String[] args) throws IOException, InterruptedException {
        if (args.length > 1) {
            System.out.println("Usage: aph [script]");
            System.exit(64);
        } else if (args.length == 1) {
            runFile(args[0]);
        } else {
            runPrompt();
        }
    }

    private static void runFile(String path) throws IOException {
        byte[] bytes = Files.readAllBytes(Paths.get(path));
        run(new String(bytes, Charset.defaultCharset()));

        if (hadError) System.exit(65);
        if (hadRuntimeError) System.exit(70);
    }

    private static void runPrompt() throws IOException, InterruptedException {
        InputStreamReader input = new InputStreamReader(System.in);
        BufferedReader reader = new BufferedReader(input);

        while(true) {
            sleep(50);
            System.out.print("> ");
            String line = reader.readLine();
            if (line.equals("")) continue;
            if (line.equals(".quit")) return;

            if (!line.endsWith(";"))
                line = line + ";";

            run(line);
            hadError = false;
        }
    }

    private static void run(String source) {
        Scanner scanner = new Scanner(source);
        List<Token> tokens = scanner.scanTokens();
        Parser parser = new Parser(tokens);
        List<Statement> statements = parser.parse();

        if (hadError) return;

        Resolver resolver = new Resolver(interpreter);
        resolver.resolve(statements);

        if (hadError) return;

        interpreter.interpret(statements);
    }

    public static void error(int line, String message) {
        report(line, "", message);
    }

    public static void error(Token token, String message) {
        if (token.getType() == EOF)
            report(token.getLine(), " at end", message);
        else
            report(token.getLine(), " at '" + token.getLexeme() + "'", message);
    }

    private static void report(int line, String where, String message) {
        System.err.println("[line " + line + "] Error" + where + ": " + message);
        hadError = true;
    }

    public static void runtimeError(RuntimeError error) {
        System.err.println("[line " + error.getToken().getLine() + "] " + error.getMessage());
        hadRuntimeError = true;
    }
}