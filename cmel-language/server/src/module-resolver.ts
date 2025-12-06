// Module resolver for handling import statements

import * as fs from 'fs';
import * as path from 'path';
import * as AST from './ast';
import { Scanner } from './scanner';
import { Parser } from './parser';
import { Token } from './scanner';
import { Diagnostic } from './analyzer';

export interface ExportInfo {
  name: string;
  kind: 'variable' | 'function' | 'class';
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
  resolveImport(importPath: string, importingFileUri: string): ModuleExports | null {
    this.diagnostics = [];

    // Resolve the import path to an absolute file path
    const absolutePath = this.resolveModulePath(importPath);
    if (!absolutePath) {
      this.diagnostics.push({
        message: `Cannot find module '${importPath}'`,
        line: 0,
        start: 0,
        end: 0,
        severity: 'error'
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
        message: `Circular import detected: ${this.importChain.join(' -> ')} -> ${absolutePath}`,
        line: 0,
        start: 0,
        end: 0,
        severity: 'error'
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
  private resolveModulePath(importPath: string): string | null {
    // Add .cmel extension if not present
    const modulePath = importPath.endsWith('.cmel') ? importPath : `${importPath}.cmel`;

    // Try as absolute path from workspace root
    const absolutePath = path.join(this.workspaceRoot, modulePath);

    // Check if file exists
    try {
      if (fs.existsSync(absolutePath)) {
        return absolutePath;
      }
    } catch (error) {
      // File doesn't exist or can't be accessed
    }

    return null;
  }

  /**
   * Parse a module file and extract its exports
   */
  private parseModule(filePath: string): ModuleExports | null {
    this.importChain.push(filePath);

    try {
      // Read file
      const source = fs.readFileSync(filePath, 'utf-8');

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
          severity: 'error'
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
        filePath
      };
    } catch (error) {
      this.diagnostics.push({
        message: `Cannot read module '${filePath}': ${error instanceof Error ? error.message : String(error)}`,
        line: 0,
        start: 0,
        end: 0,
        severity: 'error'
      });
      this.importChain.pop();
      return null;
    }
  }

  /**
   * Extract exported symbols from a module AST
   */
  private extractExports(ast: AST.Program): Map<string, ExportInfo> {
    const exports = new Map<string, ExportInfo>();

    for (const statement of ast.body) {
      if (statement.kind === 'VarDeclaration' && statement.isExport) {
        exports.set(statement.name.lexeme, {
          name: statement.name.lexeme,
          kind: 'variable',
          isConst: statement.isConst,
          token: statement.name,
          node: statement
        });
      } else if (statement.kind === 'FunDeclaration' && statement.isExport) {
        exports.set(statement.name.lexeme, {
          name: statement.name.lexeme,
          kind: 'function',
          isConst: true,
          token: statement.name,
          node: statement
        });
      } else if (statement.kind === 'ClassDeclaration' && statement.isExport) {
        exports.set(statement.name.lexeme, {
          name: statement.name.lexeme,
          kind: 'class',
          isConst: true,
          token: statement.name,
          node: statement
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
