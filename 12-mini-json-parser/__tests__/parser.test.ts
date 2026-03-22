import { parseJSON, isJsonError, LexerError, ParseError } from "../src/index";

// ─── Primitives ──────────────────────────────────────────────────────────────

describe("null", () => {
  test("parses null", () => expect(parseJSON("null")).toBeNull());
});

describe("boolean", () => {
  test("parses true", ()  => expect(parseJSON("true")).toBe(true));
  test("parses false", () => expect(parseJSON("false")).toBe(false));
});

describe("number", () => {
  test("integer",          () => expect(parseJSON("42")).toBe(42));
  test("negative",         () => expect(parseJSON("-7")).toBe(-7));
  test("zero",             () => expect(parseJSON("0")).toBe(0));
  test("float",            () => expect(parseJSON("3.14")).toBeCloseTo(3.14));
  test("exponent lower",   () => expect(parseJSON("1e3")).toBe(1000));
  test("exponent upper",   () => expect(parseJSON("1E3")).toBe(1000));
  test("positive exp",     () => expect(parseJSON("2.5e+2")).toBe(250));
  test("negative exp",     () => expect(parseJSON("2.5e-1")).toBeCloseTo(0.25));
  test("large integer",    () => expect(parseJSON("1234567890")).toBe(1234567890));
  test("negative float",   () => expect(parseJSON("-0.5")).toBeCloseTo(-0.5));
});

describe("string", () => {
  test("empty string",     () => expect(parseJSON('""')).toBe(""));
  test("simple",           () => expect(parseJSON('"hello"')).toBe("hello"));
  test("with space",       () => expect(parseJSON('"hello world"')).toBe("hello world"));

  // Escape sequences
  test("escape quote",     () => expect(parseJSON('"say \\"hi\\""')).toBe('say "hi"'));
  test("escape backslash", () => expect(parseJSON('"\\\\"')).toBe("\\"));
  test("escape slash",     () => expect(parseJSON('"a\\/b"')).toBe("a/b"));
  test("escape \\b",       () => expect(parseJSON('"\\b"')).toBe("\b"));
  test("escape \\f",       () => expect(parseJSON('"\\f"')).toBe("\f"));
  test("escape \\n",       () => expect(parseJSON('"\\n"')).toBe("\n"));
  test("escape \\r",       () => expect(parseJSON('"\\r"')).toBe("\r"));
  test("escape \\t",       () => expect(parseJSON('"\\t"')).toBe("\t"));

  // Unicode escapes
  test("\\u0041 = A",      () => expect(parseJSON('"\\u0041"')).toBe("A"));
  test("\\u00e9 = é",      () => expect(parseJSON('"\\u00e9"')).toBe("é"));
  test("CJK character",    () => expect(parseJSON('"\\u4e2d\\u6587"')).toBe("中文"));
  test("emoji via surrogate pair", () => {
    // 😀 = U+1F600 = \uD83D\uDE00
    expect(parseJSON('"\\uD83D\\uDE00"')).toBe("😀");
  });
  test("mixed text and escapes", () =>
    expect(parseJSON('"Hello\\nWorld\\t!"')).toBe("Hello\nWorld\t!"));
});

// ─── Array ───────────────────────────────────────────────────────────────────

describe("array", () => {
  test("empty array",        () => expect(parseJSON("[]")).toEqual([]));
  test("single element",     () => expect(parseJSON("[1]")).toEqual([1]));
  test("multiple elements",  () => expect(parseJSON("[1, 2, 3]")).toEqual([1, 2, 3]));
  test("mixed types",        () => expect(parseJSON('[null, true, 42, "hi"]')).toEqual([null, true, 42, "hi"]));
  test("nested arrays",      () => expect(parseJSON("[[1,2],[3,4]]")).toEqual([[1, 2], [3, 4]]));
  test("array of objects",   () => {
    expect(parseJSON('[{"a":1},{"b":2}]')).toEqual([{ a: 1 }, { b: 2 }]);
  });
  test("whitespace ignored", () => expect(parseJSON("[ 1 , 2 , 3 ]")).toEqual([1, 2, 3]));
});

// ─── Object ──────────────────────────────────────────────────────────────────

describe("object", () => {
  test("empty object",       () => expect(parseJSON("{}")).toEqual({}));
  test("single key",         () => expect(parseJSON('{"a":1}')).toEqual({ a: 1 }));
  test("multiple keys",      () => expect(parseJSON('{"a":1,"b":2}')).toEqual({ a: 1, b: 2 }));
  test("string value",       () => expect(parseJSON('{"name":"Alice"}')).toEqual({ name: "Alice" }));
  test("boolean values",     () => expect(parseJSON('{"x":true,"y":false}')).toEqual({ x: true, y: false }));
  test("null value",         () => expect(parseJSON('{"v":null}')).toEqual({ v: null }));
  test("nested object",      () => expect(parseJSON('{"a":{"b":{"c":3}}}')).toEqual({ a: { b: { c: 3 } } }));
  test("array value",        () => expect(parseJSON('{"arr":[1,2,3]}')).toEqual({ arr: [1, 2, 3] }));
  test("whitespace",         () => expect(parseJSON('{ "k" : "v" }')).toEqual({ k: "v" }));
  test("multiline",          () => {
    const src = `{
      "name": "Bob",
      "age": 30,
      "active": true
    }`;
    expect(parseJSON(src)).toEqual({ name: "Bob", age: 30, active: true });
  });
  test("escaped key",        () => expect(parseJSON('{"he\\"llo":1}')).toEqual({ 'he"llo': 1 }));
  test("duplicate keys: last wins", () => {
    // RFC 8259 §4 leaves duplicate behaviour to implementations;
    // most parsers (including this one) keep the last value.
    const result = parseJSON('{"a":1,"a":2}') as Record<string, number>;
    expect(result["a"]).toBe(2);
  });
});

// ─── Complex / Real-World ────────────────────────────────────────────────────

describe("complex", () => {
  test("JSON.parse parity — simple object", () => {
    const src = '{"name":"Alice","age":30,"scores":[100,95,87]}';
    expect(parseJSON(src)).toEqual(JSON.parse(src));
  });

  test("JSON.parse parity — nested", () => {
    const src = JSON.stringify({
      users: [
        { id: 1, name: "Alice", tags: ["admin", "user"] },
        { id: 2, name: "Bob",   tags: [] },
      ],
      meta: { total: 2, page: 1 },
    });
    expect(parseJSON(src)).toEqual(JSON.parse(src));
  });

  test("deeply nested", () => {
    const src = '{"a":{"b":{"c":{"d":{"e":42}}}}}';
    expect(parseJSON(src)).toEqual({ a: { b: { c: { d: { e: 42 } } } } });
  });

  test("array of mixed nesting", () => {
    const src = '[1,[2,[3,[4]]],{"x":[5,6]}]';
    expect(parseJSON(src)).toEqual([1, [2, [3, [4]]], { x: [5, 6] }]);
  });
});

// ─── Whitespace handling ─────────────────────────────────────────────────────

describe("whitespace", () => {
  test("tabs and newlines", () => {
    expect(parseJSON("\t\n  42  \n\t")).toBe(42);
  });
  test("cr+lf", () => {
    expect(parseJSON("{\r\n  \"k\": 1\r\n}")).toEqual({ k: 1 });
  });
});

// ─── Error cases ─────────────────────────────────────────────────────────────

describe("errors — lex", () => {
  test("unterminated string", () => {
    expect(() => parseJSON('"hello')).toThrow(LexerError);
  });
  test("invalid escape", () => {
    expect(() => parseJSON('"\\q"')).toThrow(LexerError);
  });
  test("unescaped control char", () => {
    expect(() => parseJSON('"\x01"')).toThrow(LexerError);
  });
  test("invalid unicode escape (non-hex)", () => {
    expect(() => parseJSON('"\\uGGGG"')).toThrow(LexerError);
  });
  test("bad literal 'tru'", () => {
    expect(() => parseJSON("tru")).toThrow(LexerError);
  });
  test("unexpected character '@'", () => {
    expect(() => parseJSON("@")).toThrow(LexerError);
  });
  test("number starting with letter", () => {
    expect(() => parseJSON("abc")).toThrow(LexerError);
  });
});

describe("errors — parse", () => {
  test("trailing content after value", () => {
    // "extra" is not valid JSON tokens, so the Lexer raises LexerError;
    // for a valid-but-extra token (e.g. two integers) it's a ParseError.
    // Both signal invalid JSON — accept either error type.
    expect(() => parseJSON("42 extra")).toThrow(/error at line/);
    expect(() => parseJSON("42 43")).toThrow(ParseError);
  });
  test("missing colon in object", () => {
    expect(() => parseJSON('{"a" 1}')).toThrow(ParseError);
  });
  test("missing closing brace", () => {
    expect(() => parseJSON('{"a":1')).toThrow(ParseError);
  });
  test("missing closing bracket", () => {
    expect(() => parseJSON("[1,2")).toThrow(ParseError);
  });
  test("trailing comma in array", () => {
    expect(() => parseJSON("[1,2,]")).toThrow(ParseError);
  });
  test("trailing comma in object", () => {
    expect(() => parseJSON('{"a":1,}')).toThrow(ParseError);
  });
  test("non-string object key", () => {
    expect(() => parseJSON("{1:2}")).toThrow(ParseError);
  });
  test("empty input", () => {
    expect(() => parseJSON("")).toThrow(ParseError);
  });
});

describe("error positions", () => {
  test("reports correct line number", () => {
    try {
      parseJSON('{\n  "a": @\n}');
    } catch (err) {
      expect(isJsonError(err)).toBe(true);
      if (isJsonError(err)) {
        expect(err.pos.line).toBe(2);
      }
    }
  });

  test("reports correct column for unterminated string", () => {
    try {
      parseJSON('"hello');
    } catch (err) {
      expect(isJsonError(err)).toBe(true);
      if (isJsonError(err)) {
        expect(err.pos.column).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

// ─── isJsonError helper ──────────────────────────────────────────────────────

describe("isJsonError", () => {
  test("returns true for ParseError",  () => expect(isJsonError(new ParseError("x", { line: 1, column: 1 }))).toBe(true));
  test("returns true for LexerError",  () => expect(isJsonError(new LexerError("x", { line: 1, column: 1 }))).toBe(true));
  test("returns false for TypeError",  () => expect(isJsonError(new TypeError("x"))).toBe(false));
  test("returns false for null",       () => expect(isJsonError(null)).toBe(false));
});
