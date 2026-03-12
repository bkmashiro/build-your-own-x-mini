# 07 — mini-vm

> A minimal stack-based bytecode VM and compiler in pure Python, with local frames and disassembly.

## Background

Stack machines are one of the simplest ways to explain how interpreters work. Instead of directly evaluating source code, we split execution into two stages:

1. Parse a small language into a syntax tree.
2. Compile that tree into bytecode instructions.
3. Run the bytecode on a virtual machine with a value stack.

That model shows up everywhere: JVM bytecode, CPython's evaluation loop, WebAssembly's stack semantics, and many teaching interpreters.

This project implements a tiny subset of Python syntax:

- arithmetic expressions
- variables
- `if`
- `while`
- functions and `return`
- `print(...)`

## Architecture

### Opcodes

The VM supports a small instruction set:

- `PUSH`, `POP`
- `ADD`, `SUB`, `MUL`, `DIV`, `MOD`
- `LOAD`, `STORE`
- `JUMP`, `JUMP_IF`
- `CALL`, `RET`
- `PRINT`, `HALT`

Expressions push values onto the stack. Arithmetic pops operands and pushes the result back. Control flow rewrites the instruction pointer with jumps.

### Frames

Each function call creates a local frame containing:

- a local variable dictionary
- the return instruction pointer
- the function name

That is enough to demonstrate how lexical names become runtime storage without implementing a full object model.

### Compiler

The compiler reuses Python's built-in `ast` parser, but only accepts a very small subset of nodes. It walks statements and emits bytecode directly:

- assignments compile to `... STORE name`
- `if` and `while` patch jump targets after body code is emitted
- function calls push arguments and emit `CALL`
- `print(x)` becomes `PRINT`

## Key Implementation

The important design choice is the split between compile time and run time:

- the compiler is responsible for structure
- the VM is responsible for stack effects and frames

This keeps both sides small. The compiler only has to emit linear instructions, and the VM only has to interpret them.

Disassembly is equally useful for learning: it makes hidden runtime steps visible, especially control flow and calls.

## How to Run

```bash
python3 demo.py
```

The demo compiles and runs three sample programs:

- recursive Fibonacci
- iterative factorial
- a simple loop-based summation

## Key Takeaways

- Stack VMs are a compact bridge between source code and machine execution.
- `if`, `while`, and function calls reduce cleanly to jumps plus call frames.
- A tiny bytecode format is enough to explain interpreter internals without compiler machinery getting in the way.
