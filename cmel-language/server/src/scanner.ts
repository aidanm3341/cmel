// Cmel tokenizer matching src/scanner.h token types

export enum TokenType {
  // Single-character tokens
  LEFT_PAREN, RIGHT_PAREN,
  LEFT_BRACE, RIGHT_BRACE,
  LEFT_BRACKET, RIGHT_BRACKET,
  COMMA, DOT, MINUS, PLUS,
  SEMICOLON, SLASH, STAR,
  PERCENT, COLON,

  // One or two character tokens
  BANG, BANG_EQUAL,
  EQUAL, EQUAL_EQUAL,
  GREATER, GREATER_EQUAL,
  LESS, LESS_EQUAL,

  // Literals
  IDENTIFIER, STRING, NUMBER,

  // Keywords
  AND, CLASS, ELSE, EXPORT, FALSE,
  FOR, FROM, FUN, IF, IMPORT, NIL, OR,
  PRINT, RETURN, SUPER, THIS,
  TRUE, VAR, CONST, WHILE,
  BREAK,

  ERROR, EOF
}

export interface Token {
  type: TokenType;
  lexeme: string;
  line: number;
  column: number;
  start: number;
  end: number;
}

const keywords: Map<string, TokenType> = new Map([
  ['and', TokenType.AND],
  ['class', TokenType.CLASS],
  ['else', TokenType.ELSE],
  ['export', TokenType.EXPORT],
  ['false', TokenType.FALSE],
  ['for', TokenType.FOR],
  ['from', TokenType.FROM],
  ['fun', TokenType.FUN],
  ['if', TokenType.IF],
  ['import', TokenType.IMPORT],
  ['nil', TokenType.NIL],
  ['or', TokenType.OR],
  ['print', TokenType.PRINT],
  ['return', TokenType.RETURN],
  ['super', TokenType.SUPER],
  ['this', TokenType.THIS],
  ['true', TokenType.TRUE],
  ['var', TokenType.VAR],
  ['const', TokenType.CONST],
  ['while', TokenType.WHILE],
  ['break', TokenType.BREAK],
]);

export class Scanner {
  private source: string;
  private start = 0;
  private current = 0;
  private line = 1;
  private column = 1;

  constructor(source: string) {
    this.source = source;
  }

  scanTokens(): Token[] {
    const tokens: Token[] = [];

    while (!this.isAtEnd()) {
      this.start = this.current;
      const token = this.scanToken();
      if (token) {
        tokens.push(token);
      }
    }

    tokens.push({
      type: TokenType.EOF,
      lexeme: '',
      line: this.line,
      column: this.column,
      start: this.current,
      end: this.current
    });

    return tokens;
  }

  private scanToken(): Token | null {
    const c = this.advance();

    switch (c) {
      case ' ':
      case '\r':
      case '\t':
        return null;
      case '\n':
        this.line++;
        this.column = 1;
        return null;
      case '(': return this.makeToken(TokenType.LEFT_PAREN);
      case ')': return this.makeToken(TokenType.RIGHT_PAREN);
      case '{': return this.makeToken(TokenType.LEFT_BRACE);
      case '}': return this.makeToken(TokenType.RIGHT_BRACE);
      case '[': return this.makeToken(TokenType.LEFT_BRACKET);
      case ']': return this.makeToken(TokenType.RIGHT_BRACKET);
      case ',': return this.makeToken(TokenType.COMMA);
      case '.': return this.makeToken(TokenType.DOT);
      case '-': return this.makeToken(TokenType.MINUS);
      case '+': return this.makeToken(TokenType.PLUS);
      case ';': return this.makeToken(TokenType.SEMICOLON);
      case '*': return this.makeToken(TokenType.STAR);
      case '%': return this.makeToken(TokenType.PERCENT);
      case ':': return this.makeToken(TokenType.COLON);
      case '!':
        return this.makeToken(this.match('=') ? TokenType.BANG_EQUAL : TokenType.BANG);
      case '=':
        return this.makeToken(this.match('=') ? TokenType.EQUAL_EQUAL : TokenType.EQUAL);
      case '<':
        return this.makeToken(this.match('=') ? TokenType.LESS_EQUAL : TokenType.LESS);
      case '>':
        return this.makeToken(this.match('=') ? TokenType.GREATER_EQUAL : TokenType.GREATER);
      case '/':
        if (this.match('/')) {
          // Comment until end of line
          while (this.peek() !== '\n' && !this.isAtEnd()) {
            this.advance();
          }
          return null;
        } else if (this.match('*')) {
          // Block comment
          while (!this.isAtEnd()) {
            if (this.peek() === '*' && this.peekNext() === '/') {
              this.advance(); // consume *
              this.advance(); // consume /
              break;
            }
            if (this.peek() === '\n') {
              this.line++;
              this.column = 1;
            }
            this.advance();
          }
          return null;
        } else {
          return this.makeToken(TokenType.SLASH);
        }
      case '"': return this.string();
      default:
        if (this.isDigit(c)) {
          return this.number();
        } else if (this.isAlpha(c)) {
          return this.identifier();
        }
        return this.errorToken(`Unexpected character: ${c}`);
    }
  }

  private string(): Token {
    while (this.peek() !== '"' && !this.isAtEnd()) {
      if (this.peek() === '\n') {
        this.line++;
        this.column = 1;
      }
      // Handle escape sequences
      if (this.peek() === '\\') {
        this.advance(); // consume backslash
        if (!this.isAtEnd()) {
          this.advance(); // consume escaped character
        }
      } else {
        this.advance();
      }
    }

    if (this.isAtEnd()) {
      return this.errorToken('Unterminated string');
    }

    this.advance(); // closing "
    return this.makeToken(TokenType.STRING);
  }

  private number(): Token {
    while (this.isDigit(this.peek())) {
      this.advance();
    }

    // Look for decimal part
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      this.advance(); // consume .
      while (this.isDigit(this.peek())) {
        this.advance();
      }
    }

    return this.makeToken(TokenType.NUMBER);
  }

  private identifier(): Token {
    while (this.isAlphaNumeric(this.peek())) {
      this.advance();
    }

    const text = this.source.substring(this.start, this.current);
    const type = keywords.get(text) || TokenType.IDENTIFIER;
    return this.makeToken(type);
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isAlpha(c: string): boolean {
    return (c >= 'a' && c <= 'z') ||
           (c >= 'A' && c <= 'Z') ||
           c === '_';
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c);
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private advance(): string {
    this.column++;
    return this.source.charAt(this.current++);
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source.charAt(this.current);
  }

  private peekNext(): string {
    if (this.current + 1 >= this.source.length) return '\0';
    return this.source.charAt(this.current + 1);
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source.charAt(this.current) !== expected) return false;
    this.current++;
    this.column++;
    return true;
  }

  private makeToken(type: TokenType): Token {
    return {
      type,
      lexeme: this.source.substring(this.start, this.current),
      line: this.line,
      column: this.column - (this.current - this.start),
      start: this.start,
      end: this.current
    };
  }

  private errorToken(message: string): Token {
    return {
      type: TokenType.ERROR,
      lexeme: message,
      line: this.line,
      column: this.column,
      start: this.start,
      end: this.current
    };
  }
}
