// Module resolver for handling import statements

import * as fs from "fs";
import * as path from "path";
import * as AST from "./ast";
import { Scanner } from "./scanner";
import { Parser } from "./parser";
import { Token } from "./scanner";
import { Diagnostic } from "./analyzer";

export interface ExportInfo {
  name: string;
  kind: "variable" | "function" | "class";
  isConst: boolean;
  token: Token;
  node: AST.VarDeclaration | AST.FunDeclaration | AST.ClassDeclaration;
}

export interface ModuleExports {
  exports: Map<string, ExportInfo>;
  ast: AST.Program;
  filePath: string;
}

export class ModuleResolver {
  private workspaceRoot: string;
  private moduleCache: Map<string, ModuleExports> = new Map();
  private importChain: string[] = [];
  private diagnostics: Diagnostic[] = [];

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Resolve an import statement and return the module's exports
   */
  resolveImport(
    importPath: string,
    importingFileUri: string
  ): ModuleExports | null {
    this.diagnostics = [];

    // Resolve the import path to an absolute file path
    const absolutePath = this.resolveModulePath(importPath, importingFileUri);
    if (!absolutePath) {
      this.diagnostics.push({
        message: `Cannot find module '${importPath}'`,
        line: 0,
        start: 0,
        end: 0,
        severity: "error",
      });
      return null;
    }

    // Check cache
    if (this.moduleCache.has(absolutePath)) {
      return this.moduleCache.get(absolutePath)!;
    }

    // Detect circular imports
    if (this.detectCircularImport(absolutePath)) {
      this.diagnostics.push({
        message: `Circular import detected: ${this.importChain.join(
          " -> "
        )} -> ${absolutePath}`,
        line: 0,
        start: 0,
        end: 0,
        severity: "error",
      });
      return null;
    }

    // Parse the module
    const moduleExports = this.parseModule(absolutePath);

    // Cache the result (even if null, to avoid repeated attempts)
    if (moduleExports) {
      this.moduleCache.set(absolutePath, moduleExports);
    }

    return moduleExports;
  }

  /**
   * Resolve import path to absolute file path
   */
  private resolveModulePath(
    importPath: string,
    importingFileUri?: string
  ): string | null {
    // Normalize stdlib: prefix to stdlib/
    let normalizedPath = importPath;
    if (importPath.startsWith("stdlib:")) {
      normalizedPath = importPath.replace("stdlib:", "stdlib/");
    }

    // Add .cmel extension if not present
    const modulePath = normalizedPath.endsWith(".cmel")
      ? normalizedPath
      : `${normalizedPath}.cmel`;

    // Try 1: Resolve relative to importing file's directory (if provided)
    if (importingFileUri) {
      // Convert file:// URI to filesystem path
      const importingFilePath = importingFileUri.replace(/^file:\/\//, "");
      const importingDir = path.dirname(importingFilePath);
      const relativePath = path.join(importingDir, modulePath);

      try {
        if (fs.existsSync(relativePath)) {
          return relativePath;
        }
      } catch (error) {
        // File doesn't exist or can't be accessed
      }
    }

    // Try 2: Resolve as absolute path from workspace root
    const absolutePath = path.join(this.workspaceRoot, modulePath);

    // Check if file exists
    try {
      if (fs.existsSync(absolutePath)) {
        return absolutePath;
      }
    } catch (error) {
      // File doesn't exist or can't be accessed
    }

    // Try 3: If it's a stdlib module and file doesn't exist, treat as embedded
    // (return a pseudo-path so the language server knows it's valid)
    if (normalizedPath.startsWith("stdlib/")) {
      const embeddedStdlib = [
        "stdlib/convert",
        "stdlib/io",
        "stdlib/math",
        "stdlib/string",
        "stdlib/list",
        "stdlib/test",
      ];
      if (embeddedStdlib.includes(normalizedPath)) {
        // Return the workspace path even if it doesn't exist
        // This allows autocomplete to work for embedded modules
        return absolutePath;
      }
    }

    return null;
  }

  /**
   * Parse a module file and extract its exports
   */
  private parseModule(filePath: string): ModuleExports | null {
    this.importChain.push(filePath);

    try {
      // Check if file exists (it might not for embedded stdlib)
      if (!fs.existsSync(filePath)) {
        // If it's an embedded stdlib module, return known exports
        const embeddedExports = this.getEmbeddedStdlibExports(filePath);
        if (embeddedExports !== null) {
          this.importChain.pop();
          return embeddedExports;
        }
      }

      // Read file
      const source = fs.readFileSync(filePath, "utf-8");

      // Scan tokens
      const scanner = new Scanner(source);
      const tokens = scanner.scanTokens();

      // Parse
      const parser = new Parser(tokens);
      const ast = parser.parse();

      // Check for parse errors
      const parseErrors = parser.getErrors();
      if (parseErrors.length > 0) {
        this.diagnostics.push({
          message: `Failed to parse module '${filePath}': ${parseErrors[0].message}`,
          line: 0,
          start: 0,
          end: 0,
          severity: "error",
        });
        this.importChain.pop();
        return null;
      }

      // Extract exports
      const exports = this.extractExports(ast);

      this.importChain.pop();

      return {
        exports,
        ast,
        filePath,
      };
    } catch (error) {
      this.diagnostics.push({
        message: `Cannot read module '${filePath}': ${
          error instanceof Error ? error.message : String(error)
        }`,
        line: 0,
        start: 0,
        end: 0,
        severity: "error",
      });
      this.importChain.pop();
      return null;
    }
  }

  /**
   * Get exports for embedded stdlib modules
   */
  private getEmbeddedStdlibExports(filePath: string): ModuleExports | null {
    // Extract module name from file path
    const moduleName = path.basename(filePath, ".cmel");

    const dummyToken = {
      type: 0,
      lexeme: "",
      line: 0,
      column: 0,
      start: 0,
      end: 0,
    };

    const exports = new Map<string, ExportInfo>();

    // Define exports for each stdlib module
    if (filePath.includes("stdlib/convert") || filePath.includes("stdlib\\convert")) {
      ["number"].forEach((name) => {
        exports.set(name, {
          name,
          kind: "function",
          isConst: true,
          token: dummyToken,
          node: {} as any,
        });
      });
    } else if (filePath.includes("stdlib/io") || filePath.includes("stdlib\\io")) {
      ["clock", "input", "readFile"].forEach((name) => {
        exports.set(name, {
          name,
          kind: "function",
          isConst: true,
          token: dummyToken,
          node: {} as any,
        });
      });
    } else if (filePath.includes("stdlib/math") || filePath.includes("stdlib\\math")) {
      ["PI", "E"].forEach((name) => {
        exports.set(name, {
          name,
          kind: "variable",
          isConst: true,
          token: dummyToken,
          node: {} as any,
        });
      });
      ["abs", "max", "min", "pow", "sqrt"].forEach((name) => {
        exports.set(name, {
          name,
          kind: "function",
          isConst: true,
          token: dummyToken,
          node: {} as any,
        });
      });
    } else if (
      filePath.includes("stdlib/string") ||
      filePath.includes("stdlib\\string")
    ) {
      ["join", "reverse", "startsWith", "endsWith"].forEach((name) => {
        exports.set(name, {
          name,
          kind: "function",
          isConst: true,
          token: dummyToken,
          node: {} as any,
        });
      });
    } else if (
      filePath.includes("stdlib/list") ||
      filePath.includes("stdlib\\list")
    ) {
      ["createListWithDefaults", "sort", "sortWith", "slice"].forEach(
        (name) => {
          exports.set(name, {
            name,
            kind: "function",
            isConst: true,
            token: dummyToken,
            node: {} as any,
          });
        }
      );
    } else if (
      filePath.includes("stdlib/test") ||
      filePath.includes("stdlib\\test")
    ) {
      [
        "suite",
        "test",
        "run",
        "assert",
        "assertEqual",
      ].forEach((name) => {
        exports.set(name, {
          name,
          kind: "function",
          isConst: true,
          token: dummyToken,
          node: {} as any,
        });
      });
    } else {
      return null;
    }

    return {
      exports,
      ast: { kind: "Program", body: [], start: 0, end: 0, line: 0 },
      filePath,
    };
  }

  /**
   * Extract exported symbols from a module AST
   */
  private extractExports(ast: AST.Program): Map<string, ExportInfo> {
    const exports = new Map<string, ExportInfo>();

    for (const statement of ast.body) {
      if (statement.kind === "VarDeclaration" && statement.isExport) {
        exports.set(statement.name.lexeme, {
          name: statement.name.lexeme,
          kind: "variable",
          isConst: statement.isConst,
          token: statement.name,
          node: statement,
        });
      } else if (statement.kind === "FunDeclaration" && statement.isExport) {
        exports.set(statement.name.lexeme, {
          name: statement.name.lexeme,
          kind: "function",
          isConst: true,
          token: statement.name,
          node: statement,
        });
      } else if (statement.kind === "ClassDeclaration" && statement.isExport) {
        exports.set(statement.name.lexeme, {
          name: statement.name.lexeme,
          kind: "class",
          isConst: true,
          token: statement.name,
          node: statement,
        });
      }
    }

    return exports;
  }

  /**
   * Detect circular imports
   */
  private detectCircularImport(filePath: string): boolean {
    return this.importChain.includes(filePath);
  }

  /**
   * Get diagnostics from the last resolve operation
   */
  getDiagnostics(): Diagnostic[] {
    return this.diagnostics;
  }

  /**
   * Clear the module cache (useful for testing or when files change)
   */
  clearCache(): void {
    this.moduleCache.clear();
  }
}
