# 06 — mini-regex

> A minimal Thompson-NFA regex engine in pure Python — under 200 lines.

## Background

Regular expressions are often taught as a mysterious backtracking machine. Under the hood, a large class of regex engines can be understood more cleanly as graph execution:

1. Parse the pattern into operators like concatenation, alternation, and repetition.
2. Convert that structure into an **NFA** with epsilon transitions.
3. Run the NFA by keeping a set of active states, expanding epsilon edges with an **epsilon-closure** step.

This project implements that idea directly. It supports:

- `.` any character
- `*`, `+`, `?`
- `|`
- `()`
- `[abc]`
- `^` and `$`
- simple capture groups

## Architecture

The engine has three small parts:

### 1. Parser

A recursive-descent parser turns the regex string into a tiny syntax tree:

- alternation: `a|b`
- concatenation: `ab`
- repetition: `a*`, `a+`, `a?`
- groups: `(ab)`
- atoms: literal chars, `.`, anchors, char classes

### 2. Thompson NFA construction

Each syntax node becomes a fragment with a start state and an end state.

- literal: one consuming transition
- concat: connect left end to right start with epsilon
- alternation: new split start, new merge end
- star/plus/question: new epsilon edges that loop or skip
- group: epsilon edges annotated with capture start/end markers

That is the core of Thompson's algorithm: every regex operator expands into a tiny reusable graph pattern.

### 3. NFA execution

At runtime, the engine does not choose one path. It keeps **all currently possible states**.

For each input position:

1. Expand epsilon transitions recursively to compute the epsilon-closure.
2. Consume one character on matching transitions.
3. Compute epsilon-closure again for the next frontier.

Anchors are treated as zero-width transitions:

- `^` only advances when the current position is `0`
- `$` only advances when the current position is `len(text)`

## Key Implementation

### Thompson's construction

Instead of building a recursive matcher, the code builds a graph once and then simulates it. That separates:

- **compile time**: regex -> NFA
- **run time**: text -> active state set

This keeps the engine readable and avoids recursive matching logic spread across each operator.

### Epsilon-closure

The closure step is what makes the NFA model work. If a state has epsilon edges, the engine follows them immediately without consuming input until no more zero-width moves remain.

That is how operators like:

- `a*` can skip the repeated branch
- `a?` can choose zero copies
- `(ab|cd)` can branch into alternatives
- capture groups can mark positions without consuming characters

### Capture groups

Group boundaries are stored as tagged epsilon edges. When the closure walks those edges, it records the current text position as the group's start or end index.

This is still an NFA execution model; the capture bookkeeping simply travels along with each active state configuration.

## How to Run

```bash
python3 demo.py
```

The demo prints several built-in examples and then enters a small REPL where you can try your own patterns and inspect:

- `search()` result
- `fullmatch()` result
- captured groups

## Key Takeaways

- Regex does not need to be a black box; a tiny NFA engine is enough to explain the core mechanics.
- Thompson's construction gives a systematic way to turn regex operators into graph fragments.
- Epsilon-closure is the central runtime idea: expand zero-width moves first, then consume input.
- Even features like groups and anchors fit naturally into the same state-machine model.
