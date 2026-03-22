/**
 * Recursive Descent Parser for JSON
 *
 * Consumes a token stream produced by the Lexer and builds a plain
 * JavaScript value (the same shape that JSON.parse returns).
 *
 * Grammar (RFC 8259):
 *   value   → object | array | STRING | NUMBER | TRUE | FALSE | NULL
 *   object  → "{" (STRING ":" value ("," STRING ":" value)*)? "}"
 *   array   → "[" (value ("," value)*)? "]"
 */

import { Lexer, Token, TokenType, Position } from "./lexer";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export class ParseError extends Error {
  constructor(message: string, public readonly pos: Position) {
    super(`Parse error at line ${pos.line}, col ${pos.column}: ${message}`);
    this.name = "ParseError";
  }
}

export class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(src: string) {
    const lexer = new Lexer(src);
    this.tokens = lexer.tokenize();
  }

  parse(): JsonValue {
    const value = this.parseValue();
    const next = this.peek();
    if (next.type !== TokenType.EOF) {
      throw new ParseError(
        `Unexpected token '${next.value}' after top-level value`,
        next.pos,
      );
    }
    return value;
  }

  // ── token stream helpers ──────────────────────────────────────────────

  private peek(): Token {
    return this.tokens[this.pos]!;
  }

  private advance(): Token {
    const tok = this.tokens[this.pos]!;
    if (tok.type !== TokenType.EOF) this.pos++;
    return tok;
  }

  private expect(type: TokenType): Token {
    const tok = this.peek();
    if (tok.type !== type) {
      throw new ParseError(
        `Expected ${type} but got ${tok.type} ('${tok.value}')`,
        tok.pos,
      );
    }
    return this.advance();
  }

  // ── grammar rules ─────────────────────────────────────────────────────

  private parseValue(): JsonValue {
    const tok = this.peek();

    switch (tok.type) {
      case TokenType.NULL:    this.advance(); return null;
      case TokenType.TRUE:    this.advance(); return true;
      case TokenType.FALSE:   this.advance(); return false;
      case TokenType.STRING:  this.advance(); return tok.value;
      case TokenType.NUMBER:  this.advance(); return this.parseNumber(tok);
      case TokenType.LBRACE:  return this.parseObject();
      case TokenType.LBRACKET: return this.parseArray();

      case TokenType.EOF:
        throw new ParseError("Unexpected end of input", tok.pos);

      default:
        throw new ParseError(
          `Unexpected token '${tok.value}' (${tok.type})`,
          tok.pos,
        );
    }
  }

  private parseNumber(tok: Token): number {
    const n = Number(tok.value);
    if (!Number.isFinite(n)) {
      throw new ParseError(`Invalid number literal '${tok.value}'`, tok.pos);
    }
    return n;
  }

  private parseObject(): { [key: string]: JsonValue } {
    this.expect(TokenType.LBRACE);
    const obj: { [key: string]: JsonValue } = {};

    if (this.peek().type === TokenType.RBRACE) {
      this.advance(); // empty object
      return obj;
    }

    while (true) {
      // Key
      const keyTok = this.peek();
      if (keyTok.type !== TokenType.STRING) {
        throw new ParseError(
          `Object key must be a string, got ${keyTok.type} ('${keyTok.value}')`,
          keyTok.pos,
        );
      }
      this.advance();
      const key = keyTok.value;

      // Colon
      this.expect(TokenType.COLON);

      // Value
      obj[key] = this.parseValue();

      // Continue or end
      const next = this.peek();
      if (next.type === TokenType.RBRACE) {
        this.advance();
        break;
      }
      if (next.type !== TokenType.COMMA) {
        throw new ParseError(
          `Expected ',' or '}' in object, got ${next.type} ('${next.value}')`,
          next.pos,
        );
      }
      this.advance(); // consume comma

      // Trailing comma check (not allowed in JSON)
      if (this.peek().type === TokenType.RBRACE) {
        throw new ParseError("Trailing comma in object is not allowed", this.peek().pos);
      }
    }

    return obj;
  }

  private parseArray(): JsonValue[] {
    this.expect(TokenType.LBRACKET);
    const arr: JsonValue[] = [];

    if (this.peek().type === TokenType.RBRACKET) {
      this.advance(); // empty array
      return arr;
    }

    while (true) {
      arr.push(this.parseValue());

      const next = this.peek();
      if (next.type === TokenType.RBRACKET) {
        this.advance();
        break;
      }
      if (next.type !== TokenType.COMMA) {
        throw new ParseError(
          `Expected ',' or ']' in array, got ${next.type} ('${next.value}')`,
          next.pos,
        );
      }
      this.advance(); // consume comma

      // Trailing comma check (not allowed in JSON)
      if (this.peek().type === TokenType.RBRACKET) {
        throw new ParseError("Trailing comma in array is not allowed", this.peek().pos);
      }
    }

    return arr;
  }
}
