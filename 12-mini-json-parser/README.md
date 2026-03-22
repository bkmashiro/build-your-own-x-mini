# 12-mini-json-parser

A hand-written, zero-dependency JSON parser in TypeScript — built as part of the **Build Your Own X (Mini)** series.

## Features

- ✅ Full JSON spec support (object, array, string, number, boolean, null)
- ✅ All string escape sequences (`\"`, `\\`, `\/`, `\b`, `\f`, `\n`, `\r`, `\t`)
- ✅ Unicode escapes (`\uXXXX`) including surrogate pairs (`\uD83D\uDE00` → 😀)
- ✅ Numbers: integers, floats, exponents, negatives
- ✅ Precise error messages with **line** and **column** numbers
- ✅ Two-phase design: Lexer (tokenizer) + recursive descent Parser

## Architecture

```
src/
├── lexer.ts    # Tokenizer — converts raw text → Token[]
├── parser.ts   # Recursive descent parser — Token[] → JsonValue
└── index.ts    # Public API (parseJSON, isJsonError, error types)
```

### Lexer (`lexer.ts`)

Scans the input character-by-character and emits strongly-typed tokens:

| Token type | Example |
|-----------|---------|
| `NULL`, `TRUE`, `FALSE` | `null`, `true`, `false` |
| `NUMBER` | `42`, `-3.14`, `1e10` |
| `STRING` | `"hello"` (value = decoded text) |
| `LBRACE` / `RBRACE` | `{` / `}` |
| `LBRACKET` / `RBRACKET` | `[` / `]` |
| `COMMA` / `COLON` | `,` / `:` |
| `EOF` | end of input |

### Parser (`parser.ts`)

Single-pass recursive descent over the token stream:

```
parseValue  → parseObject | parseArray | literal
parseObject → "{" (key ":" value ("," key ":" value)*)? "}"
parseArray  → "[" (value ("," value)*)? "]"
```

## Usage

```typescript
import { parseJSON, isJsonError } from "./src/index";

const data = parseJSON('{"name":"Alice","scores":[100,95]}');
// → { name: "Alice", scores: [100, 95] }

try {
  parseJSON("invalid!");
} catch (err) {
  if (isJsonError(err)) {
    console.error(err.message);
    // "Lexer error at line 1, col 1: Unexpected character 'i'"
    console.error(err.pos); // { line: 1, column: 1 }
  }
}
```

## Development

```bash
npm install
npm test          # run Jest tests
npm run build     # compile to dist/
```

## What's NOT supported (intentional simplifications)

- `JSON.stringify` (parse only)
- Streaming / partial input
- `reviver` callback
- `Infinity` / `NaN` (not valid JSON)

## Key learnings

- **Two-phase lexing** keeps the parser clean — the parser never touches raw characters
- **Surrogate pairs** require special handling: JSON encodes characters outside the BMP as two consecutive `\uXXXX` sequences
- **Position tracking** is best done in the lexer, not the parser — every token already carries its source location
- **Trailing commas** are explicitly rejected (they are invalid JSON despite being accepted by many JS parsers)
