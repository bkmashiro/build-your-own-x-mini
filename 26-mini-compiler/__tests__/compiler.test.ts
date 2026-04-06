import {
  tokenizer,
  parser,
  transformer,
  codeGenerator,
  compile,
  Token,
  LispProgram,
  CProgram,
} from "../src/index";

// ─────────────────────────────────────────────
// Tokenizer tests
// ─────────────────────────────────────────────

describe("tokenizer", () => {
  it("tokenizes parentheses", () => {
    expect(tokenizer("()")).toEqual<Token[]>([
      { type: "paren", value: "(" },
      { type: "paren", value: ")" },
    ]);
  });

  it("tokenizes numbers", () => {
    expect(tokenizer("42 100")).toEqual<Token[]>([
      { type: "number", value: "42" },
      { type: "number", value: "100" },
    ]);
  });

  it("tokenizes names (identifiers)", () => {
    expect(tokenizer("add subtract")).toEqual<Token[]>([
      { type: "name", value: "add" },
      { type: "name", value: "subtract" },
    ]);
  });

  it("tokenizes string literals", () => {
    expect(tokenizer('"hello"')).toEqual<Token[]>([
      { type: "string", value: "hello" },
    ]);
  });

  it("skips whitespace", () => {
    const tokens = tokenizer("  (  add  2  )  ");
    expect(tokens).toEqual<Token[]>([
      { type: "paren", value: "(" },
      { type: "name", value: "add" },
      { type: "number", value: "2" },
      { type: "paren", value: ")" },
    ]);
  });

  it("tokenizes a full Lisp expression", () => {
    const tokens = tokenizer("(add 2 (subtract 4 2))");
    expect(tokens).toEqual<Token[]>([
      { type: "paren", value: "(" },
      { type: "name", value: "add" },
      { type: "number", value: "2" },
      { type: "paren", value: "(" },
      { type: "name", value: "subtract" },
      { type: "number", value: "4" },
      { type: "number", value: "2" },
      { type: "paren", value: ")" },
      { type: "paren", value: ")" },
    ]);
  });

  it("tokenizes negative integer literals", () => {
    expect(tokenizer("-5")).toEqual<Token[]>([{ type: "number", value: "-5" }]);
  });

  it("tokenizes floating-point literals", () => {
    expect(tokenizer("3.14")).toEqual<Token[]>([{ type: "number", value: "3.14" }]);
  });

  it("tokenizes negative floating-point literals", () => {
    expect(tokenizer("-0.5")).toEqual<Token[]>([{ type: "number", value: "-0.5" }]);
  });

  it("tokenizes negative number inside an expression", () => {
    expect(tokenizer("(add -3 2)")).toEqual<Token[]>([
      { type: "paren", value: "(" },
      { type: "name", value: "add" },
      { type: "number", value: "-3" },
      { type: "number", value: "2" },
      { type: "paren", value: ")" },
    ]);
  });

  it("does not treat a bare minus as a number", () => {
    expect(() => tokenizer("-")).toThrow(TypeError);
  });

  it("returns empty array for empty input", () => {
    expect(tokenizer("")).toEqual<Token[]>([]);
  });

  it("throws TypeError for unknown characters, including the offending char in the message", () => {
    expect(() => tokenizer("@")).toThrow(TypeError);
    expect(() => tokenizer("@")).toThrow("@");
    expect(() => tokenizer("(add # 2)")).toThrow(TypeError);
    expect(() => tokenizer("(add # 2)")).toThrow("#");
  });

  it("throws on unterminated string literal", () => {
    expect(() => tokenizer('"hello')).toThrow();
  });

  it("returns empty array for empty string input", () => {
    expect(tokenizer("")).toEqual<Token[]>([]);
  });

  it("throws a meaningful error on unterminated string literal", () => {
    expect(() => tokenizer('"hello')).toThrow();
    expect(() => tokenizer('"hello')).toThrow(/unterminated/i);
  });

  it("skips mixed whitespace (spaces, tabs, newlines) between tokens", () => {
    expect(tokenizer("(\t add \n 2\r\n )")).toEqual<Token[]>([
      { type: "paren", value: "(" },
      { type: "name", value: "add" },
      { type: "number", value: "2" },
      { type: "paren", value: ")" },
    ]);
  });

  it("tokenizes a number immediately followed by ( with no whitespace", () => {
    expect(tokenizer("(add 1(2 3))")).toEqual<Token[]>([
      { type: "paren", value: "(" },
      { type: "name", value: "add" },
      { type: "number", value: "1" },
      { type: "paren", value: "(" },
      { type: "number", value: "2" },
      { type: "number", value: "3" },
      { type: "paren", value: ")" },
      { type: "paren", value: ")" },
    ]);
  });

  it("error message includes the offending character and its position", () => {
    expect(() => tokenizer("add @1 2")).toThrow(
      /Unexpected character '@' at position 4/
    );
  });

  it("error message includes a surrounding snippet of the input", () => {
    const err = (() => {
      try {
        tokenizer("add @1 2");
      } catch (e) {
        return e as Error;
      }
    })();
    expect(err).toBeInstanceOf(TypeError);
    expect(err!.message).toContain("add @1");
  });

  it("error message includes the full input length", () => {
    const input = "add @1 2";
    expect(() => tokenizer(input)).toThrow(
      new RegExp(`input length: ${input.length}`)
    );
  });

  it("reports correct position when unknown character is at the start", () => {
    expect(() => tokenizer("@foo")).toThrow(/at position 0/);
  });

  it("reports correct position when unknown character is at the end", () => {
    expect(() => tokenizer("(add 1 2)@")).toThrow(/at position 9/);
  });
});

// ─────────────────────────────────────────────
// Parser tests
// ─────────────────────────────────────────────

describe("parser", () => {
  it("parses a number literal at top level", () => {
    const ast = parser([{ type: "number", value: "5" }]);
    expect(ast).toEqual<LispProgram>({
      type: "Program",
      body: [{ type: "NumberLiteral", value: "5" }],
    });
  });

  it("parses a simple call expression", () => {
    const tokens = tokenizer("(add 1 2)");
    const ast = parser(tokens);
    expect(ast).toEqual<LispProgram>({
      type: "Program",
      body: [
        {
          type: "CallExpression",
          name: "add",
          params: [
            { type: "NumberLiteral", value: "1" },
            { type: "NumberLiteral", value: "2" },
          ],
        },
      ],
    });
  });

  it("parses nested call expressions", () => {
    const tokens = tokenizer("(add 2 (subtract 4 2))");
    const ast = parser(tokens);
    expect(ast).toEqual<LispProgram>({
      type: "Program",
      body: [
        {
          type: "CallExpression",
          name: "add",
          params: [
            { type: "NumberLiteral", value: "2" },
            {
              type: "CallExpression",
              name: "subtract",
              params: [
                { type: "NumberLiteral", value: "4" },
                { type: "NumberLiteral", value: "2" },
              ],
            },
          ],
        },
      ],
    });
  });

  it("parses string literals inside call expressions", () => {
    const tokens = tokenizer('(print "hello")');
    const ast = parser(tokens);
    expect(ast.body[0]).toEqual({
      type: "CallExpression",
      name: "print",
      params: [{ type: "StringLiteral", value: "hello" }],
    });
  });

  it("parses multiple top-level expressions", () => {
    const tokens = tokenizer("(add 1 2)(subtract 4 2)");
    const ast = parser(tokens);
    expect(ast.body).toHaveLength(2);
    expect(ast.body[0]).toMatchObject({ type: "CallExpression", name: "add" });
    expect(ast.body[1]).toMatchObject({ type: "CallExpression", name: "subtract" });
  });

  it("throws on missing closing paren", () => {
    const tokens = tokenizer("(add 1 2");
    // manually remove the trailing ')' that tokenizer won't produce
    expect(() => parser(tokens)).toThrow(SyntaxError);
  });

  it("throws SyntaxError with clear message when input ends mid-expression", () => {
    // '(add 1' — opening paren and name present, but no args closing paren
    const tokens = tokenizer("(add 1");
    expect(() => parser(tokens)).toThrow(SyntaxError);
    expect(() => parser(tokens)).toThrow(/unexpected end of input/i);
  });

  it("returns empty program for empty token list", () => {
    // Empty input is valid — produces an empty Program body
    expect(parser([])).toEqual<LispProgram>({ type: "Program", body: [] });
  });

  it("throws SyntaxError when '(' has no function name (truncated)", () => {
    // Just an opening paren with nothing after
    const tokens = tokenizer("(");
    expect(() => parser(tokens)).toThrow(SyntaxError);
    expect(() => parser(tokens)).toThrow(/unexpected end of input/i);
  });

  it("throws on unclosed nested parens '((add 1'", () => {
    const tokens = tokenizer("((add 1");
    expect(() => parser(tokens)).toThrow(SyntaxError);
  });
});

// ─────────────────────────────────────────────
// Transformer tests
// ─────────────────────────────────────────────

describe("transformer", () => {
  it("transforms a simple call expression", () => {
    const lispAst: LispProgram = {
      type: "Program",
      body: [
        {
          type: "CallExpression",
          name: "add",
          params: [
            { type: "NumberLiteral", value: "1" },
            { type: "NumberLiteral", value: "2" },
          ],
        },
      ],
    };

    const cAst = transformer(lispAst);

    expect(cAst).toEqual<CProgram>({
      type: "Program",
      body: [
        {
          type: "ExpressionStatement",
          expression: {
            type: "CallExpression",
            callee: { type: "Identifier", name: "add" },
            arguments: [
              { type: "NumberLiteral", value: "1" },
              { type: "NumberLiteral", value: "2" },
            ],
          },
        },
      ],
    });
  });

  it("transforms nested call expressions", () => {
    const lispAst: LispProgram = {
      type: "Program",
      body: [
        {
          type: "CallExpression",
          name: "add",
          params: [
            { type: "NumberLiteral", value: "2" },
            {
              type: "CallExpression",
              name: "subtract",
              params: [
                { type: "NumberLiteral", value: "4" },
                { type: "NumberLiteral", value: "2" },
              ],
            },
          ],
        },
      ],
    };

    const cAst = transformer(lispAst);
    const stmt = cAst.body[0];
    expect(stmt.type).toBe("ExpressionStatement");
    expect(stmt.expression.callee.name).toBe("add");

    const nestedArg = stmt.expression.arguments[1];
    expect(nestedArg.type).toBe("CallExpression");
    if (nestedArg.type === "CallExpression") {
      expect(nestedArg.callee.name).toBe("subtract");
    }
  });

  it("transforms string literals", () => {
    const lispAst: LispProgram = {
      type: "Program",
      body: [
        {
          type: "CallExpression",
          name: "print",
          params: [{ type: "StringLiteral", value: "hello" }],
        },
      ],
    };

    const cAst = transformer(lispAst);
    const arg = cAst.body[0].expression.arguments[0];
    expect(arg).toEqual({ type: "StringLiteral", value: "hello" });
  });
});

// ─────────────────────────────────────────────
// Code Generator tests
// ─────────────────────────────────────────────

describe("codeGenerator", () => {
  it("generates a simple call expression", () => {
    const cAst: CProgram = {
      type: "Program",
      body: [
        {
          type: "ExpressionStatement",
          expression: {
            type: "CallExpression",
            callee: { type: "Identifier", name: "add" },
            arguments: [
              { type: "NumberLiteral", value: "1" },
              { type: "NumberLiteral", value: "2" },
            ],
          },
        },
      ],
    };

    expect(codeGenerator(cAst)).toBe("add(1, 2);");
  });

  it("generates nested call expressions", () => {
    const cAst: CProgram = {
      type: "Program",
      body: [
        {
          type: "ExpressionStatement",
          expression: {
            type: "CallExpression",
            callee: { type: "Identifier", name: "add" },
            arguments: [
              { type: "NumberLiteral", value: "2" },
              {
                type: "CallExpression",
                callee: { type: "Identifier", name: "subtract" },
                arguments: [
                  { type: "NumberLiteral", value: "4" },
                  { type: "NumberLiteral", value: "2" },
                ],
              },
            ],
          },
        },
      ],
    };

    expect(codeGenerator(cAst)).toBe("add(2, subtract(4, 2));");
  });

  it("generates string literals with quotes", () => {
    const cAst: CProgram = {
      type: "Program",
      body: [
        {
          type: "ExpressionStatement",
          expression: {
            type: "CallExpression",
            callee: { type: "Identifier", name: "print" },
            arguments: [{ type: "StringLiteral", value: "hello" }],
          },
        },
      ],
    };

    expect(codeGenerator(cAst)).toBe('print("hello");');
  });

  it("joins multiple statements with newlines", () => {
    const cAst: CProgram = {
      type: "Program",
      body: [
        {
          type: "ExpressionStatement",
          expression: {
            type: "CallExpression",
            callee: { type: "Identifier", name: "foo" },
            arguments: [],
          },
        },
        {
          type: "ExpressionStatement",
          expression: {
            type: "CallExpression",
            callee: { type: "Identifier", name: "bar" },
            arguments: [],
          },
        },
      ],
    };

    expect(codeGenerator(cAst)).toBe("foo();\nbar();");
  });
});

// ─────────────────────────────────────────────
// Full pipeline (compile) tests
// ─────────────────────────────────────────────

describe("compile (full pipeline)", () => {
  it("compiles (add 2 (subtract 4 2))", () => {
    expect(compile("(add 2 (subtract 4 2))")).toBe("add(2, subtract(4, 2));");
  });

  it("compiles a simple single-arg call", () => {
    expect(compile("(foo 42)")).toBe("foo(42);");
  });

  it('compiles a string argument', () => {
    expect(compile('(print "hello")')).toBe('print("hello");');
  });

  it("compiles no-argument calls", () => {
    expect(compile("(noop)")).toBe("noop();");
  });

  it("compiles deeply nested expressions", () => {
    expect(compile("(a (b (c 1)))")).toBe("a(b(c(1)));");
  });

  it("compiles multiple top-level expressions", () => {
    const result = compile("(add 1 2)(subtract 5 3)");
    expect(result).toBe("add(1, 2);\nsubtract(5, 3);");
  });

  it("compiles expressions with multiple arguments", () => {
    expect(compile("(max 1 2 3)")).toBe("max(1, 2, 3);");
  });

  it("roundtrip: tokenize → parse → transform → generate", () => {
    const input = "(multiply (add 1 2) (subtract 10 4))";
    expect(compile(input)).toBe("multiply(add(1, 2), subtract(10, 4));");
  });

  it("compiles a negative number literal argument", () => {
    expect(compile("(negate -5)")).toBe("negate(-5);");
  });

  it("compiles an expression with a negative number", () => {
    expect(compile("(add -3 2)")).toBe("add(-3, 2);");
  });

  it("compiles a floating-point argument", () => {
    expect(compile("(multiply 3.14 2)")).toBe("multiply(3.14, 2);");
  });

  it("compiles negative float argument", () => {
    expect(compile("(scale -0.5)")).toBe("scale(-0.5);");
  });

  it("compiles mixed negative and float arguments", () => {
    expect(compile("(add -1.5 2.5)")).toBe("add(-1.5, 2.5);");
  });
});

// ─────────────────────────────────────────────
// Edge case tests
// ─────────────────────────────────────────────

describe("edge cases — empty / whitespace-only input", () => {
  it("compile('') returns an empty string without throwing", () => {
    expect(() => compile("")).not.toThrow();
    expect(compile("")).toBe("");
  });

  it("compile('   ') returns an empty string without throwing", () => {
    expect(() => compile("   ")).not.toThrow();
    expect(compile("   ")).toBe("");
  });

  it("tokenizer('') returns an empty token array", () => {
    expect(tokenizer("")).toEqual<Token[]>([]);
  });

  it("tokenizer('   ') returns an empty token array", () => {
    expect(tokenizer("   ")).toEqual<Token[]>([]);
  });
});

describe("edge cases — negative number literals", () => {
  // The tokenizer regex only matches [0-9], so a leading `-` is an unknown character.
  // Until negative literals are supported, the tokenizer must throw a clear TypeError
  // rather than silently misparsing (e.g. treating `-` as a name fragment).
  it("tokenizer throws TypeError on a standalone negative number", () => {
    expect(() => tokenizer("-3")).toThrow(TypeError);
  });

  it("tokenizer throws TypeError on a negative number inside an expression", () => {
    expect(() => tokenizer("(sub 5 -3)")).toThrow(TypeError);
  });
});

describe("edge cases — escaped quotes in string literals", () => {
  // The string lexer stops at the first `"` and does not handle `\"` escape sequences.
  // Given input `(print "hello\"world")`:
  //   - The string token is collected as `hello\` (stops at the escaped `"`)
  //   - `world` is then tokenized as a separate name token
  //   - The trailing `)` closes the paren
  //   - The remaining `"` at the end opens a new, unterminated string with value `)`
  // Net result: NO throw, but the token stream is silently wrong.
  // This test documents the current broken behaviour so a future fix is detectable.
  it('tokenizer silently misparses a string containing an escaped quote', () => {
    // Should ideally throw or return [paren, name, string("hello\"world"), paren].
    // Currently it does neither — it miserably produces extra tokens instead.
    const tokens = tokenizer('(print "hello\\"world")');
    // The string token value is truncated at the backslash-preceded `"`.
    const stringToken = tokens.find((t) => t.type === "string");
    expect(stringToken?.value).not.toBe('hello"world');
  });
});
