/**
 * 26-mini-compiler
 *
 * A tiny compiler that transforms Lisp-style function calls to C-style.
 *
 * Pipeline:
 *   source code (Lisp) → tokenizer → tokens → parser → AST
 *   → transformer → new AST → code generator → output (C-style)
 *
 * Example:
 *   (add 2 (subtract 4 2))
 *   ↓
 *   add(2, subtract(4, 2))
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type TokenType = "paren" | "number" | "string" | "name";

export interface Token {
  type: TokenType;
  value: string;
}

// ── AST node types (input / Lisp) ──

export interface NumberLiteral {
  type: "NumberLiteral";
  value: string;
}

export interface StringLiteral {
  type: "StringLiteral";
  value: string;
}

export interface CallExpression {
  type: "CallExpression";
  name: string;
  params: LispNode[];
}

export type LispNode = NumberLiteral | StringLiteral | CallExpression;

export interface LispProgram {
  type: "Program";
  body: LispNode[];
}

// ── AST node types (output / C-style) ──

export interface CNumberLiteral {
  type: "NumberLiteral";
  value: string;
}

export interface CStringLiteral {
  type: "StringLiteral";
  value: string;
}

export interface CCallExpression {
  type: "CallExpression";
  callee: CIdentifier;
  arguments: CNode[];
}

export interface CIdentifier {
  type: "Identifier";
  name: string;
}

export interface CExpressionStatement {
  type: "ExpressionStatement";
  expression: CCallExpression;
}

export type CNode = CNumberLiteral | CStringLiteral | CCallExpression | CIdentifier;

export interface CProgram {
  type: "Program";
  body: CExpressionStatement[];
}

// ─────────────────────────────────────────────
// Stage 1 — Tokenizer (Lexer)
// ─────────────────────────────────────────────

/**
 * Tokenizes a Lisp source string into an array of tokens.
 *
 * Supported tokens:
 *   - Parentheses: `(` and `)`
 *   - Whitespace: skipped
 *   - Numbers: sequences of digits
 *   - Strings: double-quoted string literals
 *   - Names: sequences of word characters (function names / identifiers)
 */
export function tokenizer(input: string): Token[] {
  const tokens: Token[] = [];
  let current = 0;

  while (current < input.length) {
    let char = input[current];

    // Parentheses
    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      current++;
      continue;
    }

    // Whitespace — skip
    if (/\s/.test(char)) {
      current++;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(char)) {
      let value = "";
      while (current < input.length && /[0-9]/.test(input[current])) {
        value += input[current++];
      }
      tokens.push({ type: "number", value });
      continue;
    }

    // String literals
    if (char === '"') {
      let value = "";
      current++; // skip opening quote
      while (current < input.length && input[current] !== '"') {
        value += input[current++];
      }
      current++; // skip closing quote
      tokens.push({ type: "string", value });
      continue;
    }

    // Names (identifiers)
    if (/[a-zA-Z_]/.test(char)) {
      let value = "";
      while (current < input.length && /[a-zA-Z0-9_]/.test(input[current])) {
        value += input[current++];
      }
      tokens.push({ type: "name", value });
      continue;
    }

    throw new TypeError(`Unknown character: "${char}" at position ${current}`);
  }

  return tokens;
}

// ─────────────────────────────────────────────
// Stage 2 — Parser (tokens → AST)
// ─────────────────────────────────────────────

/**
 * Parses a flat token array into a Lisp AST.
 */
export function parser(tokens: Token[]): LispProgram {
  let current = 0;

  function walk(): LispNode {
    if (current >= tokens.length) {
      throw new SyntaxError("Unexpected end of input");
    }

    let token = tokens[current];

    if (token.type === "number") {
      current++;
      return { type: "NumberLiteral", value: token.value };
    }

    if (token.type === "string") {
      current++;
      return { type: "StringLiteral", value: token.value };
    }

    if (token.type === "paren" && token.value === "(") {
      current++; // skip `(`
      if (current >= tokens.length) {
        throw new SyntaxError("Unexpected end of input — missing function name after '('");
      }
      token = tokens[current];

      if (token.type !== "name") {
        throw new SyntaxError(
          `Expected function name after '(', got: ${token.type} "${token.value}"`
        );
      }

      const node: CallExpression = {
        type: "CallExpression",
        name: token.value,
        params: [],
      };

      current++; // skip function name
      token = tokens[current];

      while (!(token.type === "paren" && token.value === ")")) {
        node.params.push(walk());
        token = tokens[current];
        if (!token) throw new SyntaxError("Unexpected end of input — missing ')'");
      }

      current++; // skip `)`
      return node;
    }

    throw new SyntaxError(`Unexpected token type: "${token.type}" value: "${token.value}"`);
  }

  const ast: LispProgram = { type: "Program", body: [] };

  while (current < tokens.length) {
    ast.body.push(walk());
  }

  return ast;
}

// ─────────────────────────────────────────────
// Stage 3 — Transformer (Lisp AST → C AST)
// ─────────────────────────────────────────────

/**
 * Transforms a Lisp-style AST into a C-style AST.
 *
 * Transformation rules:
 *  - Program body items become ExpressionStatements
 *  - CallExpression { name, params } → CallExpression { callee: Identifier, arguments }
 *  - NumberLiteral and StringLiteral pass through unchanged
 */
export function transformer(ast: LispProgram): CProgram {
  function transformNode(node: LispNode): CNode {
    switch (node.type) {
      case "NumberLiteral":
        return { type: "NumberLiteral", value: node.value };

      case "StringLiteral":
        return { type: "StringLiteral", value: node.value };

      case "CallExpression": {
        const cCall: CCallExpression = {
          type: "CallExpression",
          callee: { type: "Identifier", name: node.name },
          arguments: node.params.map(transformNode),
        };
        return cCall;
      }
    }
  }

  const newAst: CProgram = {
    type: "Program",
    body: ast.body.map((node) => {
      const expr = transformNode(node);
      if (expr.type !== "CallExpression") {
        throw new Error(
          `Top-level statement must be a CallExpression, got: ${expr.type}`
        );
      }
      return {
        type: "ExpressionStatement",
        expression: expr as CCallExpression,
      };
    }),
  };

  return newAst;
}

// ─────────────────────────────────────────────
// Stage 4 — Code Generator (C AST → string)
// ─────────────────────────────────────────────

/**
 * Generates C-style source code from a C AST.
 */
export function codeGenerator(node: CProgram | CNode | CExpressionStatement): string {
  const n = node as { type: string };

  switch (n.type) {
    case "Program": {
      const prog = node as CProgram;
      return prog.body.map(codeGenerator).join("\n");
    }

    case "ExpressionStatement": {
      const stmt = node as CExpressionStatement;
      return codeGenerator(stmt.expression) + ";";
    }

    case "CallExpression": {
      const call = node as CCallExpression;
      const callee = codeGenerator(call.callee);
      const args = call.arguments.map(codeGenerator).join(", ");
      return `${callee}(${args})`;
    }

    case "Identifier": {
      const id = node as CIdentifier;
      return id.name;
    }

    case "NumberLiteral": {
      const num = node as CNumberLiteral;
      return num.value;
    }

    case "StringLiteral": {
      const str = node as CStringLiteral;
      return `"${str.value}"`;
    }

    default:
      throw new TypeError(`Unknown node type: "${n.type}"`);
  }
}

// ─────────────────────────────────────────────
// Top-level compiler function
// ─────────────────────────────────────────────

/**
 * Compiles a Lisp-style source string to C-style output.
 *
 * ```
 * (add 2 (subtract 4 2))
 * // → add(2, subtract(4, 2));
 * ```
 */
export function compile(input: string): string {
  const tokens = tokenizer(input);
  const lispAst = parser(tokens);
  const cAst = transformer(lispAst);
  return codeGenerator(cAst);
}
