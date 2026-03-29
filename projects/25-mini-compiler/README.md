# mini-compiler

> A tiny compiler in pure Python: lexer, recursive-descent parser, AST, and stack-based code generation.

[中文](README.zh.md)

---

## Background

A compiler pipeline becomes much easier to reason about when you shrink the language:

- tokenize source text
- parse tokens with operator precedence
- build an explicit AST
- emit target instructions from the tree

This project supports arithmetic expressions, parentheses, unary `+` / `-`, variables, and assignment statements. The generated output is a minimal stack-machine instruction stream, which keeps code generation visible.

---

## Architecture

```text
source
  -> tokenize into NUMBER / IDENT / operators
  -> parse into Program / Assign / BinaryOp / UnaryOp nodes
  -> generate stack instructions
  -> optionally run on a tiny VM
```

---

## Grammar

```text
program    := statement*
statement  := IDENT "=" expression | expression
expression := term (("+" | "-") term)*
term       := factor (("*" | "/") factor)*
factor     := NUMBER | IDENT | "(" expression ")" | ("+" | "-") factor
```

The parser is recursive descent, so precedence is encoded directly in `expression -> term -> factor`.

---

## Code Generation

The compiler emits stack instructions such as:

```text
PUSH 2
PUSH 3
PUSH 4
MUL
ADD
STORE x
```

This makes the mapping from AST to execution order explicit:

- leaf nodes push values
- binary operators evaluate left then right
- assignments store the top of the stack into an environment slot

---

## How to Run

```bash
python projects/25-mini-compiler/demo.py
```

The demo prints tokens, AST, generated stack code, and the final execution result.

---

## What This Omits

- function calls
- strings and booleans
- control flow
- SSA / register allocation
- machine code emission

Those belong in a larger compiler, but they are unnecessary for understanding the core lexer-parser-AST-codegen pipeline.
