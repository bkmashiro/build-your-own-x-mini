/**
 * mini-json-parser — Public API
 *
 * Drop-in subset of JSON.parse with richer error messages.
 */

export { JsonValue } from "./parser";
export { LexerError } from "./lexer";
export { ParseError } from "./parser";

import { Parser, JsonValue } from "./parser";
import { LexerError } from "./lexer";
import { ParseError } from "./parser";

/**
 * Parse a JSON string and return the corresponding JavaScript value.
 *
 * @param src  - The JSON text to parse.
 * @returns    - Parsed value (null | boolean | number | string | array | object).
 * @throws {LexerError | ParseError} with `pos: { line, column }` on invalid input.
 */
export function parseJSON(src: string): JsonValue {
  const parser = new Parser(src);
  return parser.parse();
}

/** Type guard: check if an error is a parse/lex error from this library. */
export function isJsonError(err: unknown): err is LexerError | ParseError {
  return err instanceof LexerError || err instanceof ParseError;
}
