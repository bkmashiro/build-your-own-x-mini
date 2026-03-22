/**
 * Lexer (Tokenizer) for JSON
 *
 * Converts a raw JSON string into a flat stream of typed tokens.
 * Handles all JSON literals, strings (with full escape sequences
 * and \uXXXX Unicode), numbers, and punctuation.
 */

export const enum TokenType {
  // Literals
  NULL = "NULL",
  TRUE = "TRUE",
  FALSE = "FALSE",
  NUMBER = "NUMBER",
  STRING = "STRING",
  // Structural
  LBRACE = "LBRACE",   // {
  RBRACE = "RBRACE",   // }
  LBRACKET = "LBRACKET", // [
  RBRACKET = "RBRACKET", // ]
  COMMA = "COMMA",      // ,
  COLON = "COLON",      // :
  // Sentinel
  EOF = "EOF",
}

export interface Position {
  line: number;   // 1-indexed
  column: number; // 1-indexed
}

export interface Token {
  type: TokenType;
  value: string;   // Raw text from source (for NUMBER / STRING = decoded value)
  pos: Position;   // Position of first character
}

export class LexerError extends Error {
  constructor(message: string, public readonly pos: Position) {
    super(`Lexer error at line ${pos.line}, col ${pos.column}: ${message}`);
    this.name = "LexerError";
  }
}

export class Lexer {
  private pos = 0;
  private line = 1;
  private column = 1;

  constructor(private readonly src: string) {}

  /** Return all tokens including EOF. */
  tokenize(): Token[] {
    const tokens: Token[] = [];
    let tok: Token;
    do {
      tok = this.next();
      tokens.push(tok);
    } while (tok.type !== TokenType.EOF);
    return tokens;
  }

  // ── private helpers ──────────────────────────────────────────────────

  private currentPos(): Position {
    return { line: this.line, column: this.column };
  }

  private peek(): string {
    return this.src[this.pos] ?? "";
  }

  private advance(): string {
    const ch = this.src[this.pos++] ?? "";
    if (ch === "\n") {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return ch;
  }

  private skipWhitespace(): void {
    while (this.pos < this.src.length) {
      const ch = this.peek();
      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
        this.advance();
      } else {
        break;
      }
    }
  }

  /** Read the next meaningful token. */
  private next(): Token {
    this.skipWhitespace();

    if (this.pos >= this.src.length) {
      return { type: TokenType.EOF, value: "", pos: this.currentPos() };
    }

    const pos = this.currentPos();
    const ch = this.peek();

    switch (ch) {
      case "{": this.advance(); return { type: TokenType.LBRACE,   value: "{", pos };
      case "}": this.advance(); return { type: TokenType.RBRACE,   value: "}", pos };
      case "[": this.advance(); return { type: TokenType.LBRACKET, value: "[", pos };
      case "]": this.advance(); return { type: TokenType.RBRACKET, value: "]", pos };
      case ",": this.advance(); return { type: TokenType.COMMA,    value: ",", pos };
      case ":": this.advance(); return { type: TokenType.COLON,    value: ":", pos };
      case '"': return this.readString(pos);
      default:
        if (ch === "-" || (ch >= "0" && ch <= "9")) return this.readNumber(pos);
        if (ch === "t") return this.readLiteral("true",  TokenType.TRUE,  pos);
        if (ch === "f") return this.readLiteral("false", TokenType.FALSE, pos);
        if (ch === "n") return this.readLiteral("null",  TokenType.NULL,  pos);
        throw new LexerError(`Unexpected character '${ch}'`, pos);
    }
  }

  // ── literal keywords ──────────────────────────────────────────────────

  private readLiteral(expected: string, type: TokenType, pos: Position): Token {
    for (const ch of expected) {
      if (this.peek() !== ch) {
        throw new LexerError(
          `Expected '${expected}', got unexpected character '${this.peek()}'`,
          this.currentPos(),
        );
      }
      this.advance();
    }
    return { type, value: expected, pos };
  }

  // ── number ────────────────────────────────────────────────────────────

  private readNumber(pos: Position): Token {
    let raw = "";

    // Optional leading minus
    if (this.peek() === "-") raw += this.advance();

    // Integer part
    if (this.peek() === "0") {
      raw += this.advance();
    } else if (this.peek() >= "1" && this.peek() <= "9") {
      while (this.peek() >= "0" && this.peek() <= "9") raw += this.advance();
    } else {
      throw new LexerError(`Invalid number: expected digit, got '${this.peek()}'`, this.currentPos());
    }

    // Optional fractional part
    if (this.peek() === ".") {
      raw += this.advance();
      if (this.peek() < "0" || this.peek() > "9") {
        throw new LexerError(`Invalid number: expected digit after '.', got '${this.peek()}'`, this.currentPos());
      }
      while (this.peek() >= "0" && this.peek() <= "9") raw += this.advance();
    }

    // Optional exponent
    if (this.peek() === "e" || this.peek() === "E") {
      raw += this.advance();
      if (this.peek() === "+" || this.peek() === "-") raw += this.advance();
      if (this.peek() < "0" || this.peek() > "9") {
        throw new LexerError(`Invalid number: expected digit in exponent, got '${this.peek()}'`, this.currentPos());
      }
      while (this.peek() >= "0" && this.peek() <= "9") raw += this.advance();
    }

    return { type: TokenType.NUMBER, value: raw, pos };
  }

  // ── string ────────────────────────────────────────────────────────────

  private readString(pos: Position): Token {
    this.advance(); // consume opening "
    let decoded = "";

    while (true) {
      if (this.pos >= this.src.length) {
        throw new LexerError("Unterminated string", pos);
      }

      const ch = this.advance();

      if (ch === '"') break; // end of string

      if (ch === "\\") {
        decoded += this.readEscape();
      } else if (ch < "\x20") {
        // Control characters must be escaped in JSON
        throw new LexerError(
          `Unescaped control character (U+${ch.codePointAt(0)!.toString(16).padStart(4, "0").toUpperCase()}) in string`,
          this.currentPos(),
        );
      } else {
        decoded += ch;
      }
    }

    return { type: TokenType.STRING, value: decoded, pos };
  }

  private readEscape(): string {
    const pos = this.currentPos();
    const ch = this.advance();
    switch (ch) {
      case '"':  return '"';
      case "\\": return "\\";
      case "/":  return "/";
      case "b":  return "\b";
      case "f":  return "\f";
      case "n":  return "\n";
      case "r":  return "\r";
      case "t":  return "\t";
      case "u":  return this.readUnicodeEscape(pos);
      default:
        throw new LexerError(`Invalid escape sequence '\\${ch}'`, pos);
    }
  }

  private readUnicodeEscape(pos: Position): string {
    let hex = "";
    for (let i = 0; i < 4; i++) {
      const ch = this.peek();
      if (!isHexDigit(ch)) {
        throw new LexerError(
          `Invalid Unicode escape: expected hex digit, got '${ch}'`,
          this.currentPos(),
        );
      }
      hex += this.advance();
    }
    const codeUnit = parseInt(hex, 16);

    // Handle surrogate pairs (UTF-16)
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      // High surrogate — expect \uXXXX low surrogate next
      if (this.peek() !== "\\" ) {
        throw new LexerError("Expected low surrogate after high surrogate", pos);
      }
      this.advance(); // consume \
      if (this.peek() !== "u") {
        throw new LexerError("Expected \\uXXXX low surrogate after high surrogate", pos);
      }
      this.advance(); // consume u
      let lowHex = "";
      for (let i = 0; i < 4; i++) {
        const ch = this.peek();
        if (!isHexDigit(ch)) {
          throw new LexerError(`Invalid Unicode escape: expected hex digit, got '${ch}'`, this.currentPos());
        }
        lowHex += this.advance();
      }
      const low = parseInt(lowHex, 16);
      if (low < 0xdc00 || low > 0xdfff) {
        throw new LexerError(`Invalid low surrogate: U+${low.toString(16).toUpperCase()}`, pos);
      }
      const codePoint = 0x10000 + ((codeUnit - 0xd800) << 10) + (low - 0xdc00);
      return String.fromCodePoint(codePoint);
    }

    return String.fromCharCode(codeUnit);
  }
}

function isHexDigit(ch: string): boolean {
  return (ch >= "0" && ch <= "9") || (ch >= "a" && ch <= "f") || (ch >= "A" && ch <= "F");
}
