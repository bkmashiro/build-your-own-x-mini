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

  it("throws on unknown characters", () => {
    expect(() => tokenizer("@")).toThrow(TypeError);
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
});
