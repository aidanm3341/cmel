// Main language server implementation

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  DocumentSymbolParams,
  SymbolInformation,
  SymbolKind,
  Location,
  ReferenceParams,
  DefinitionParams,
  HoverParams,
  Hover,
  SignatureHelpParams,
  SignatureHelp,
  SignatureInformation,
  ParameterInformation,
  RenameParams,
  WorkspaceEdit,
  TextEdit,
  Range,
  Position,
  DiagnosticSeverity
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { Scanner, TokenType } from './scanner';
import { Parser } from './parser';
import { Analyzer, Symbol } from './analyzer';
import * as AST from './ast';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Document analysis cache
const documentAnalysis = new Map<string, {
  ast: AST.Program;
  analyzer: Analyzer;
  tokens: ReturnType<Scanner['scanTokens']>;
}>();

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let workspaceRoot: string | null = null;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  // Capture workspace root
  if (params.workspaceFolders && params.workspaceFolders.length > 0) {
    workspaceRoot = URI.parse(params.workspaceFolders[0].uri).fsPath;
  } else if (params.rootUri) {
    workspaceRoot = URI.parse(params.rootUri).fsPath;
  } else if (params.rootPath) {
    workspaceRoot = params.rootPath;
  }

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['.', '"']
      },
      definitionProvider: true,
      referencesProvider: true,
      hoverProvider: true,
      documentSymbolProvider: true,
      signatureHelpProvider: {
        triggerCharacters: ['(', ',']
      },
      renameProvider: true
    }
  };

  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    };
  }

  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
});

// Analyze document
function analyzeDocument(document: TextDocument): void {
  const text = document.getText();
  const allDiagnostics: any[] = [];

  try {
    const scanner = new Scanner(text);
    const tokens = scanner.scanTokens();

    // Check for scanner errors
    for (const token of tokens) {
      if (token.type === TokenType.ERROR) {
        allDiagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: document.positionAt(token.start),
            end: document.positionAt(token.end)
          },
          message: token.lexeme,
          source: 'cmel'
        });
      }
    }

    const parser = new Parser(tokens);
    const ast = parser.parse();

    // Add parse errors
    for (const error of parser.getErrors()) {
      allDiagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: document.positionAt(error.token.start),
          end: document.positionAt(error.token.end)
        },
        message: error.message,
        source: 'cmel'
      });
    }

    // Determine workspace root, falling back to document directory
    let effectiveWorkspaceRoot = workspaceRoot;
    if (!effectiveWorkspaceRoot) {
      const documentPath = URI.parse(document.uri).fsPath;
      const path = require('path');
      const fs = require('fs');
      effectiveWorkspaceRoot = path.dirname(documentPath);

      // Try to find project root by looking for typical project markers
      let currentDir = effectiveWorkspaceRoot;
      while (currentDir !== path.dirname(currentDir)) {
        // Check for common project root markers
        if (fs.existsSync(path.join(currentDir, 'package.json')) ||
            fs.existsSync(path.join(currentDir, '.git')) ||
            fs.existsSync(path.join(currentDir, 'stdlib'))) {
          effectiveWorkspaceRoot = currentDir;
          break;
        }
        currentDir = path.dirname(currentDir);
      }
    }

    const analyzer = new Analyzer(effectiveWorkspaceRoot);
    analyzer.analyze(ast, document.uri);

    documentAnalysis.set(document.uri, { ast, analyzer, tokens });

    // Add semantic diagnostics
    const semanticDiagnostics = analyzer.getDiagnostics().map(d => ({
      severity: d.severity === 'error' ? DiagnosticSeverity.Error : d.severity === 'warning' ? DiagnosticSeverity.Warning : DiagnosticSeverity.Information,
      range: {
        start: document.positionAt(d.start),
        end: document.positionAt(d.end)
      },
      message: d.message,
      source: 'cmel'
    }));

    allDiagnostics.push(...semanticDiagnostics);

    connection.sendDiagnostics({ uri: document.uri, diagnostics: allDiagnostics });
  } catch (error) {
    // Catastrophic parse error - send what we have plus the error
    allDiagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 1 }
      },
      message: error instanceof Error ? error.message : 'Parse error',
      source: 'cmel'
    });
    connection.sendDiagnostics({ uri: document.uri, diagnostics: allDiagnostics });
  }
}

documents.onDidChangeContent(change => {
  analyzeDocument(change.document);
});

documents.onDidClose(e => {
  documentAnalysis.delete(e.document.uri);
  connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

// Go to Definition
connection.onDefinition((params: DefinitionParams): Location | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const analysis = documentAnalysis.get(params.textDocument.uri);
  if (!analysis) return null;

  const offset = document.offsetAt(params.position);
  const symbol = analysis.analyzer.getSymbolAt(offset);

  if (symbol) {
    const token = symbol.declarationToken;
    return {
      uri: params.textDocument.uri,
      range: {
        start: document.positionAt(token.start),
        end: document.positionAt(token.end)
      }
    };
  }

  return null;
});

// Find All References
connection.onReferences((params: ReferenceParams): Location[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const analysis = documentAnalysis.get(params.textDocument.uri);
  if (!analysis) return [];

  const offset = document.offsetAt(params.position);
  const symbol = analysis.analyzer.getSymbolAt(offset);

  if (!symbol) return [];

  const references = analysis.analyzer.getReferences(symbol.name);
  const locations: Location[] = [];

  // Include declaration if requested
  if (params.context.includeDeclaration) {
    const token = symbol.declarationToken;
    locations.push({
      uri: params.textDocument.uri,
      range: {
        start: document.positionAt(token.start),
        end: document.positionAt(token.end)
      }
    });
  }

  // Add all references
  for (const ref of references) {
    locations.push({
      uri: params.textDocument.uri,
      range: {
        start: document.positionAt(ref.token.start),
        end: document.positionAt(ref.token.end)
      }
    });
  }

  return locations;
});

// Rename Symbol
connection.onRenameRequest((params: RenameParams): WorkspaceEdit | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const analysis = documentAnalysis.get(params.textDocument.uri);
  if (!analysis) return null;

  const offset = document.offsetAt(params.position);
  const symbol = analysis.analyzer.getSymbolAt(offset);

  if (!symbol) return null;

  const edits: TextEdit[] = [];

  // Rename declaration
  const declToken = symbol.declarationToken;
  edits.push({
    range: {
      start: document.positionAt(declToken.start),
      end: document.positionAt(declToken.end)
    },
    newText: params.newName
  });

  // Rename all references
  const references = analysis.analyzer.getReferences(symbol.name);
  for (const ref of references) {
    edits.push({
      range: {
        start: document.positionAt(ref.token.start),
        end: document.positionAt(ref.token.end)
      },
      newText: params.newName
    });
  }

  return {
    changes: {
      [params.textDocument.uri]: edits
    }
  };
});

// Hover
connection.onHover((params: HoverParams): Hover | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const analysis = documentAnalysis.get(params.textDocument.uri);
  if (!analysis) return null;

  const offset = document.offsetAt(params.position);
  const symbol = analysis.analyzer.getSymbolAt(offset);

  if (!symbol) return null;

  let hoverText = `\`\`\`cmel\n`;

  if (symbol.kind === 'function') {
    const funDecl = symbol.declarationNode as AST.FunDeclaration;
    if (funDecl.kind === 'FunDeclaration') {
      const params = funDecl.params.map(p => p.lexeme).join(', ');
      hoverText += `fun ${symbol.name}(${params})`;
    } else {
      hoverText += `fun ${symbol.name}()`;
    }
  } else if (symbol.kind === 'class') {
    hoverText += `class ${symbol.name}`;
  } else if (symbol.kind === 'variable') {
    hoverText += `${symbol.isConst ? 'const' : 'var'} ${symbol.name}`;
  } else if (symbol.kind === 'parameter') {
    hoverText += `parameter ${symbol.name}`;
  }

  hoverText += '\n```';

  return {
    contents: {
      kind: 'markdown',
      value: hoverText
    }
  };
});

// Document Symbols
connection.onDocumentSymbol((params: DocumentSymbolParams): SymbolInformation[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const analysis = documentAnalysis.get(params.textDocument.uri);
  if (!analysis) return [];

  const symbols: SymbolInformation[] = [];

  for (const [name, symbol] of analysis.analyzer.getSymbols()) {
    // Skip built-ins and parameters
    if (symbol.declarationToken.line === 0) continue;
    if (symbol.kind === 'parameter') continue;

    let kind: SymbolKind = SymbolKind.Variable;
    if (symbol.kind === 'function') kind = SymbolKind.Function;
    if (symbol.kind === 'class') kind = SymbolKind.Class;
    if (symbol.kind === 'method') kind = SymbolKind.Method;

    const token = symbol.declarationToken;
    symbols.push({
      name: symbol.name,
      kind,
      location: {
        uri: params.textDocument.uri,
        range: {
          start: document.positionAt(token.start),
          end: document.positionAt(token.end)
        }
      }
    });
  }

  return symbols;
});

// Signature Help
connection.onSignatureHelp((params: SignatureHelpParams): SignatureHelp | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const analysis = documentAnalysis.get(params.textDocument.uri);
  if (!analysis) return null;

  // Find the function being called
  const offset = document.offsetAt(params.position);
  const text = document.getText();

  // Look backwards for function name
  let i = offset - 1;
  while (i >= 0 && (text[i] === ' ' || text[i] === '(')) i--;

  let end = i + 1;
  while (i >= 0 && /[a-zA-Z0-9_]/.test(text[i])) i--;

  const functionName = text.substring(i + 1, end);
  if (!functionName) return null;

  const symbols = analysis.analyzer.getSymbols();
  const symbol = symbols.get(functionName);

  if (!symbol || symbol.kind !== 'function') {
    // Check built-ins
    return getBuiltinSignature(functionName);
  }

  const funDecl = symbol.declarationNode as AST.FunDeclaration;
  if (funDecl.kind !== 'FunDeclaration') return null;

  const parameters = funDecl.params.map(p => ({
    label: p.lexeme
  }));

  return {
    signatures: [{
      label: `${functionName}(${funDecl.params.map(p => p.lexeme).join(', ')})`,
      parameters: parameters
    }],
    activeSignature: 0,
    activeParameter: 0 // Could calculate based on comma count
  };
});

function getBuiltinSignature(name: string): SignatureHelp | null {
  const builtins: Record<string, SignatureInformation> = {
    'clock': {
      label: 'clock()',
      parameters: []
    },
    'input': {
      label: 'input()',
      parameters: []
    },
    'readFile': {
      label: 'readFile(path)',
      parameters: [{ label: 'path' }]
    },
    'number': {
      label: 'number(value)',
      parameters: [{ label: 'value' }]
    },
    // Test framework control functions
    '__enterTestMode': {
      label: '__enterTestMode()',
      parameters: []
    },
    '__exitTestMode': {
      label: '__exitTestMode()',
      parameters: []
    },
    '__setCurrentTest': {
      label: '__setCurrentTest(name)',
      parameters: [{ label: 'name' }]
    },
    '__testFailed': {
      label: '__testFailed()',
      parameters: []
    },
    '__getLastFailure': {
      label: '__getLastFailure()',
      parameters: []
    },
    '__clearLastFailure': {
      label: '__clearLastFailure()',
      parameters: []
    },
    // Assertion functions
    'assert': {
      label: 'assert(condition, message?)',
      parameters: [{ label: 'condition' }, { label: 'message' }]
    },
    'assertEqual': {
      label: 'assertEqual(expected, actual)',
      parameters: [{ label: 'expected' }, { label: 'actual' }]
    }
  };

  if (builtins[name]) {
    return {
      signatures: [builtins[name]],
      activeSignature: 0,
      activeParameter: 0
    };
  }

  return null;
}

// Completion
connection.onCompletion((params: TextDocumentPositionParams): CompletionItem[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const analysis = documentAnalysis.get(params.textDocument.uri);
  if (!analysis) return [];

  const completions: CompletionItem[] = [];

  // Get current line to check context
  const line = document.getText({
    start: { line: params.position.line, character: 0 },
    end: params.position
  });

  // Import path completion
  if (line.includes('import') && line.includes('"')) {
    return [
      { label: 'stdlib/math', kind: CompletionItemKind.Module },
      { label: 'stdlib/string', kind: CompletionItemKind.Module },
      { label: 'stdlib/list', kind: CompletionItemKind.Module }
    ];
  }

  // Method completion (after dot)
  if (line.endsWith('.')) {
    return [
      // String methods
      { label: 'length', kind: CompletionItemKind.Method, detail: '() -> Number' },
      { label: 'split', kind: CompletionItemKind.Method, detail: '(delimiter) -> List' },
      // List methods
      { label: 'add', kind: CompletionItemKind.Method, detail: '(element)' },
      { label: 'remove', kind: CompletionItemKind.Method, detail: '(index)' },
      // Map methods
      { label: 'keys', kind: CompletionItemKind.Method, detail: '() -> List' },
      { label: 'values', kind: CompletionItemKind.Method, detail: '() -> List' },
      { label: 'has', kind: CompletionItemKind.Method, detail: '(key) -> Boolean' }
    ];
  }

  // Add all symbols in scope
  for (const [name, symbol] of analysis.analyzer.getSymbols()) {
    let kind: CompletionItemKind = CompletionItemKind.Variable;
    let detail = '';

    if (symbol.kind === 'function') {
      kind = CompletionItemKind.Function;
      const funDecl = symbol.declarationNode as AST.FunDeclaration;
      if (funDecl.kind === 'FunDeclaration') {
        detail = `(${funDecl.params.map(p => p.lexeme).join(', ')})`;
      }
    } else if (symbol.kind === 'class') {
      kind = CompletionItemKind.Class;
    } else if (symbol.kind === 'parameter') {
      kind = CompletionItemKind.Variable;
      detail = 'parameter';
    }

    completions.push({
      label: name,
      kind,
      detail
    });
  }

  // Add keywords
  const keywords = [
    'var', 'const', 'fun', 'class', 'if', 'else', 'while', 'for',
    'return', 'break', 'true', 'false', 'nil', 'this', 'super',
    'print', 'import', 'export', 'from', 'and', 'or'
  ];

  for (const keyword of keywords) {
    completions.push({
      label: keyword,
      kind: CompletionItemKind.Keyword
    });
  }

  return completions;
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return item;
});

documents.listen(connection);
connection.listen();
