# 26-mini-compiler

A tiny compiler that transforms Lisp-style function calls into C-style function calls in TypeScript.

## Pipeline

```text
source string → tokenizer → tokens → parser → Lisp AST → transformer → C AST → code generator → output string
```

1. **Tokenizer** — scans the source character-by-character and emits a flat list of typed tokens
2. **Parser** — consumes the token list and builds a Lisp-style AST (`Program → [CallExpression | NumberLiteral | StringLiteral]`)
3. **Transformer** — converts the Lisp AST into a C-style AST (wraps top-level calls in `ExpressionStatement`, restructures `CallExpression` to use a `callee` + `arguments` shape)
4. **Code generator** — walks the C AST and emits the final string

## Supported syntax

| Construct | Example input | Example output |
|---|---|---|
| Integer literal | `42` | `42` |
| String literal | `"hello"` | `"hello"` |
| Function call | `(add 1 2)` | `add(1, 2);` |
| Nested call | `(add 2 (subtract 4 2))` | `add(2, subtract(4, 2));` |
| Parenthesized expression | `(a (b (c 1)))` | `a(b(c(1)));` |
| No-argument call | `(noop)` | `noop();` |
| Multiple top-level statements | `(foo 1)(bar 2)` | `foo(1);\nbar(2);` |

## Known limitations

- **No decimal numbers** — `3.14` causes a `TypeError` on the `.` character
- **No infix operators** — `+`, `-`, `*`, `/`, `==`, etc. are all unknown characters
- **No comments** — `;` or `#` style comments are not recognised
- **Top-level literals are rejected** — bare `42` or `"hello"` at the top level fails in the transformer (only `CallExpression` is a valid statement)
- **No boolean or nil literals** — `true`, `false`, and `nil`/`null` are treated as identifiers, not literals
- **Unclosed strings loop forever** — a string literal missing its closing `"` will hang

## Usage example

```ts
import { compile, tokenizer, parser, transformer, codeGenerator } from "./src/index";

const source = "(add 2 (subtract 4 2))";

// Stage 1 — tokenize
const tokens = tokenizer(source);
// [
//   { type: "paren",  value: "(" },
//   { type: "name",   value: "add" },
//   { type: "number", value: "2" },
//   { type: "paren",  value: "(" },
//   { type: "name",   value: "subtract" },
//   { type: "number", value: "4" },
//   { type: "number", value: "2" },
//   { type: "paren",  value: ")" },
//   { type: "paren",  value: ")" },
// ]

// Stage 2 — parse into Lisp AST
const lispAst = parser(tokens);
// {
//   type: "Program",
//   body: [{
//     type: "CallExpression",
//     name: "add",
//     params: [
//       { type: "NumberLiteral", value: "2" },
//       {
//         type: "CallExpression",
//         name: "subtract",
//         params: [
//           { type: "NumberLiteral", value: "4" },
//           { type: "NumberLiteral", value: "2" },
//         ],
//       },
//     ],
//   }],
// }

// Stage 3 — transform into C AST
const cAst = transformer(lispAst);
// {
//   type: "Program",
//   body: [{
//     type: "ExpressionStatement",
//     expression: {
//       type: "CallExpression",
//       callee: { type: "Identifier", name: "add" },
//       arguments: [
//         { type: "NumberLiteral", value: "2" },
//         {
//           type: "CallExpression",
//           callee: { type: "Identifier", name: "subtract" },
//           arguments: [
//             { type: "NumberLiteral", value: "4" },
//             { type: "NumberLiteral", value: "2" },
//           ],
//         },
//       ],
//     },
//   }],
// }

// Stage 4 — generate output
const output = codeGenerator(cAst);
// "add(2, subtract(4, 2));"

// Or use the top-level helper to run all four stages at once:
compile("(add 2 (subtract 4 2))"); // → "add(2, subtract(4, 2));"
```

## Structure

```text
26-mini-compiler/
├── src/index.ts          — tokenizer, parser, transformer, codeGenerator, compile
├── __tests__/compiler.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Run tests

```bash
npm test
```
