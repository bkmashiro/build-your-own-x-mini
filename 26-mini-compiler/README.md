# 26-mini-compiler

A tiny Lisp-to-C transpiler in ~250 lines — implements all four classic compiler stages.

## Pipeline

```
source (Lisp)  →  tokenizer  →  tokens
                                   ↓
                               parser  →  Lisp AST
                                               ↓
                                        transformer  →  C AST
                                                            ↓
                                                    code generator  →  C output
```

| Stage | Input | Output |
|-------|-------|--------|
| **Tokenizer** | Raw source string | `Token[]` |
| **Parser** | `Token[]` | `LispProgram` AST |
| **Transformer** | `LispProgram` AST | `CProgram` AST |
| **Code Generator** | `CProgram` AST | C-style string |

## Usage

```typescript
import { compile } from './src/index';

compile('(add 2 (subtract 4 2))');
// → 'add(2, subtract(4, 2));'

compile('(print "hello")');
// → 'print("hello");'

compile('(add 1 2)(subtract 5 3)');
// → 'add(1, 2);\nsubtract(5, 3);'
```

You can also invoke each stage individually:

```typescript
import { tokenizer, parser, transformer, codeGenerator } from './src/index';

const tokens  = tokenizer('(multiply 3 4)');
const lispAst = parser(tokens);
const cAst    = transformer(lispAst);
const output  = codeGenerator(cAst);
// → 'multiply(3, 4);'
```

## Structure

```text
26-mini-compiler/
├── src/index.ts
├── __tests__/compiler.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

## API

### `compile(input: string): string`

Runs the full pipeline. Throws `TypeError` on unknown characters and `SyntaxError` on malformed expressions.

### `tokenizer(input: string): Token[]`

Lexes a Lisp source string into tokens. Recognises parentheses, numbers, double-quoted strings, and word-character identifiers. Skips whitespace.

### `parser(tokens: Token[]): LispProgram`

Builds a `LispProgram` AST from a flat token array. Supports nested call expressions and multiple top-level statements.

### `transformer(ast: LispProgram): CProgram`

Converts the Lisp AST into a C-style AST:
- `CallExpression { name, params }` → `ExpressionStatement > CallExpression { callee: Identifier, arguments }`
- `NumberLiteral` and `StringLiteral` pass through unchanged.

### `codeGenerator(node: CProgram | CNode | CExpressionStatement): string`

Serialises a C AST node to a string. Multiple top-level statements are joined with `\n`; each statement ends with `;`.

### Types

```typescript
// Tokens
type TokenType = 'paren' | 'number' | 'string' | 'name';
interface Token { type: TokenType; value: string }

// Lisp AST
type LispNode = NumberLiteral | StringLiteral | CallExpression;
interface LispProgram { type: 'Program'; body: LispNode[] }

// C AST
type CNode = CNumberLiteral | CStringLiteral | CCallExpression | CIdentifier;
interface CProgram { type: 'Program'; body: CExpressionStatement[] }
```

## Test

```bash
npx jest
```
