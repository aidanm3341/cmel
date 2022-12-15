package com.aidan.tools;

import java.io.IOException;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.List;

public class GenerateAST {
    public static void main(String[] args) throws IOException {
        if (args.length != 1) {
            System.err.println("Usage: generate_ast <output_dir>");
            System.exit(64);
        }
        String outputDir = args[0];

        defineAst(outputDir, "Expression", List.of(
                "Binary : Expression left, Token operator, Expression right",
                "Grouping : Expression expression",
                "Literal : Object value",
                "Unary : Token operator, Expression right"
        ));
    }

    private static void defineAst(String outputDir, String baseName, List<String>types) throws IOException {
        String path = outputDir + "/" + baseName + ".java";
        PrintWriter writer = new PrintWriter(path, StandardCharsets.UTF_8);

        writer.println("package com.aidan.aph;");
        writer.println();
        writer.println("import java.util.List;");
        writer.println();
        writer.println("public abstract class " + baseName + " {");

        for (String type : types) {
            String className = type.split(":")[0].trim();
            String fields = type.split(":")[1].trim();
            defineType(writer, baseName, className, fields);
        }

        writer.print("}");
        writer.close();
    }

    private static void defineType(PrintWriter writer, String baseName, String className, String fields) {
        String[] fieldList = fields.split(",");
        writer.print(("static class " + className + " extends " + baseName + " {").indent(4));

        //fields
        for (String field : fieldList) {
            writer.print(("final " + field + ";").indent(8));
        }

        // constructor
        writer.print(("public " + className + "(" + fields + ") {").indent(8));
        for (String field : fieldList) {
            String name = field.trim().split(" ")[1];
            writer.print(("this." + name + " = " + name + ";").indent(12));
        }
        writer.print("}".indent(8));

        writer.print("}".indent(4));
    }
}
