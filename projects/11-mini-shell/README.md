# mini-shell

> A POSIX-style interactive shell in ~190 lines of Python.  
> Tokenizer → AST → fork/exec with pipes, redirects, and builtins.

[中文](README.zh.md)

---

## Background

Every Unix shell you've ever typed into does roughly the same five things:

1. **Read** a line from the user
2. **Tokenize** it (quotes, escapes, variable expansion)
3. **Parse** the tokens into commands and pipelines
4. **Fork** child processes and wire them together with pipes
5. **Wait** for children and report the exit code

Most real shells (bash, zsh) add job control, arithmetic, functions, and thousands of edge cases on top — but the core loop above is all you need to understand what's really going on.

---

## Architecture

```
REPL (input loop)
    │
    ▼
Tokenizer          "echo $HOME | grep usr"
    │               → ['echo', '/home/alice', '|', 'grep', 'usr']
    ▼
Parser (AST)       pipelines → [Cmd, Cmd]
    │               each Cmd: argv, stdin_file, stdout_file, append
    ▼
exec_pipeline()
    ├── os.pipe()  — create n-1 anonymous pipes
    ├── os.fork()  — one child per Cmd
    │       ├── child: dup2 pipe fds, apply redirects, execvpe()
    │       └── parent: collect pids
    └── os.waitpid() × n  — reap children, return last exit code
```

Builtins (`cd`, `export`, `echo`) must run **in the parent process** because they mutate state (working directory, environment) that wouldn't survive a fork+exec roundtrip.

---

## Key Implementation

### Tokenizer

The tokenizer is a single-pass state machine over the input string.

```python
if ch == "'":           # single quotes: everything literal
    ...
if ch == '"':           # double quotes: $VAR expansion only
    ...
if ch == '$':           # bare variable: $HOME or ${HOME}
    ...
if ch in SPECIAL:       # |, <, >, >>, ;, &  emit as own tokens
    ...
```

`>>` is handled by peeking one character ahead before emitting `>`.

### Pipes (the `os.pipe()` + `os.fork()` dance)

```
cmd0  ──write──► pipe[0] ──read──► cmd1  ──write──► pipe[1] ──read──► cmd2
```

For *n* commands we create *n−1* pipes before forking. Each child:
- inherits **read end of previous pipe** → dup2 onto fd 0
- inherits **write end of next pipe** → dup2 onto fd 1
- then closes *all* pipe fds so the read ends see EOF when writers exit

The parent closes all pipe fds too (critical — otherwise readers block forever waiting for a writer that never closes).

### Redirects

Applied in the child **after fork, before exec**:

```python
fd = os.open(file, os.O_RDONLY)
os.dup2(fd, 0)   # stdin
os.close(fd)
```

`>>` uses `os.O_APPEND` instead of `os.O_TRUNC`.

### Variable Expansion

Handled during tokenization, not at parse time:

```python
if ch == '$':
    var_name = read_identifier(line, i)
    current.append(os.environ.get(var_name, ''))
```

Double-quoted strings allow `$VAR` but suppress other expansions; single-quoted strings suppress everything.

---

## How to Run

```bash
# Interactive REPL
python3 src/mini_shell.py

# Automated demo (no TTY required)
python3 demo.py
```

Example session:

```
~/projects $ echo "hello world"
hello world
~/projects $ ls src | grep py
mini_shell.py
~/projects $ export GREETING=hi
~/projects $ echo $GREETING there
hi there
~/projects $ echo done > /tmp/out.txt; cat /tmp/out.txt
done
~/projects $ exit
```

---

## Key Takeaways

| Concept | How it works in mini-shell |
|:--------|:--------------------------|
| **Tokenization** | Single-pass state machine; handles quotes, escapes, `$VAR` |
| **Pipes** | `os.pipe()` × (n−1), `os.dup2()` in each child |
| **Redirects** | `os.open()` + `os.dup2()` after fork, before exec |
| **Builtins** | Run in parent process; can't use fork (they mutate process state) |
| **Variable expansion** | Happens at tokenize time, single pass, respects quoting rules |
| **Semicolons** | Split token stream into separate pipelines, run sequentially |
| **EOF handling** | Parent must close all pipe fds or readers block forever |

The hardest part of building a real shell isn't parsing — it's getting the pipe/fork/dup2 dance right so that EOF propagates correctly through multi-stage pipelines.
