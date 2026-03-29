# mini-lisp

> A tiny Lisp interpreter in pure Python: tokenizer, reader, evaluator, closures, and tail-call optimization.

[中文](README.zh.md)

---

## Background

Lisp is one of the smallest languages that still exposes the core shape of an interpreter:

- turn source text into tokens
- read tokens into nested lists
- evaluate lists against an environment
- represent functions as closures over captured scope

That makes it a good fit for a sub-200-line implementation. The syntax stays tiny because code is already data: a function call is just a list whose first item is the operator.

---

## Architecture

```text
source
  -> tokenize
  -> parse into nested Python lists
  -> evaluate against chained environments
  -> call builtin or user-defined procedure
```

The interpreter supports:

- numbers and booleans
- `define`, `lambda`, `if`, `begin`, `quote`
- lexical scoping with closures
- tail-call optimization for user-defined functions

---

## Key Implementation

### Reader

The reader converts parentheses into nested Python lists. For example:

```lisp
(+ 1 (* 2 3))
```

becomes:

```python
["+", 1, ["*", 2, 3]]
```

### Environment

Each scope is an `Env` that points to an outer scope. Variable lookup walks outward until it finds the binding, which gives lexical scoping almost for free.

### Closures

`lambda` returns a `Procedure` that stores parameters, body, and the environment where it was created. Calling it creates a child scope whose outer pointer goes back to that captured environment.

### Tail Calls

Instead of recursively calling `evaluate` for every user function application, the evaluator rewrites `expr` and `env` inside a loop. Tail-recursive programs like `sumdown` can therefore run thousands of steps without growing the Python call stack.

---

## How to Run

```bash
python projects/15-mini-lisp/demo.py
python -m pytest projects/15-mini-lisp/test -q
```

The demo builds a closure, runs a tail-recursive sum, and prints the resulting list.

---

## What This Omits

- macros
- strings and comments
- quasiquote / unquote
- multiple-expression lambda bodies
- garbage collection internals

Those belong in a fuller Scheme or Lisp, but they are not necessary to understand the read-eval-apply loop.
