"""
mini-shell — ~190 lines
Tokenizer, fork/exec, pipes, redirects, builtins (cd/exit/export/echo).
"""

import os
import sys
import signal
import readline  # noqa: F401  — enables arrow-key history in input()
from typing import Iterator

# ── Tokenizer ────────────────────────────────────────────────────────────────

SPECIAL = set('|<>&;()')

def tokenize(line: str) -> list[str]:
    """Split a shell line into tokens, respecting quotes and escape chars."""
    tokens: list[str] = []
    current: list[str] = []
    i, n = 0, len(line)

    while i < n:
        ch = line[i]

        # Skip unquoted whitespace
        if ch in ' \t\n' and not current:
            i += 1
            continue

        if ch in ' \t\n':
            tokens.append(''.join(current))
            current = []
            i += 1
            continue

        # Escape character
        if ch == '\\' and i + 1 < n:
            current.append(line[i + 1])
            i += 2
            continue

        # Single-quoted string — everything literal
        if ch == "'":
            i += 1
            while i < n and line[i] != "'":
                current.append(line[i])
                i += 1
            i += 1  # skip closing quote
            continue

        # Double-quoted string — variable expansion only
        if ch == '"':
            i += 1
            while i < n and line[i] != '"':
                if line[i] == '$' and i + 1 < n:
                    i += 1
                    var, i = _read_var(line, i)
                    current.append(os.environ.get(var, ''))
                else:
                    current.append(line[i])
                    i += 1
            i += 1
            continue

        # Variable expansion
        if ch == '$':
            i += 1
            var, i = _read_var(line, i)
            current.append(os.environ.get(var, ''))
            continue

        # Single-char specials flush current and emit as own token
        if ch in SPECIAL:
            if current:
                tokens.append(''.join(current))
                current = []
            # handle >> as one token
            if ch == '>' and i + 1 < n and line[i + 1] == '>':
                tokens.append('>>')
                i += 2
            else:
                tokens.append(ch)
                i += 1
            continue

        current.append(ch)
        i += 1

    if current:
        tokens.append(''.join(current))

    return tokens


def _read_var(line: str, i: int) -> tuple[str, int]:
    """Read a variable name starting at i; returns (name, new_i)."""
    if i < len(line) and line[i] == '{':
        end = line.index('}', i + 1)
        return line[i + 1:end], end + 1
    start = i
    while i < len(line) and (line[i].isalnum() or line[i] == '_'):
        i += 1
    return line[start:i], i

# ── Command / Pipeline AST ───────────────────────────────────────────────────

class Cmd:
    """A single command with argv, redirects, and optional background flag."""
    __slots__ = ('argv', 'stdin_file', 'stdout_file', 'append', 'background')

    def __init__(self) -> None:
        self.argv: list[str] = []
        self.stdin_file: str | None = None
        self.stdout_file: str | None = None
        self.append: bool = False
        self.background: bool = False


def parse(tokens: list[str]) -> list[list[Cmd]]:
    """Parse tokens into a list of pipelines; each pipeline is a list[Cmd]."""
    pipelines: list[list[Cmd]] = []
    for pipeline_tokens in _split_on(tokens, ';'):
        pipe = _parse_pipeline(pipeline_tokens)
        if pipe:
            pipelines.append(pipe)
    return pipelines


def _split_on(tokens: list[str], sep: str) -> Iterator[list[str]]:
    chunk: list[str] = []
    for t in tokens:
        if t == sep:
            yield chunk
            chunk = []
        else:
            chunk.append(t)
    yield chunk


def _parse_pipeline(tokens: list[str]) -> list[Cmd]:
    cmds: list[Cmd] = []
    for seg in _split_on(tokens, '|'):
        cmd = _parse_cmd(seg)
        if cmd.argv:
            cmds.append(cmd)
    return cmds


def _parse_cmd(tokens: list[str]) -> Cmd:
    cmd = Cmd()
    i = 0
    while i < len(tokens):
        t = tokens[i]
        if t == '<' and i + 1 < len(tokens):
            cmd.stdin_file = tokens[i + 1]; i += 2
        elif t == '>' and i + 1 < len(tokens):
            cmd.stdout_file = tokens[i + 1]; cmd.append = False; i += 2
        elif t == '>>' and i + 1 < len(tokens):
            cmd.stdout_file = tokens[i + 1]; cmd.append = True; i += 2
        elif t == '&':
            cmd.background = True; i += 1
        else:
            cmd.argv.append(t); i += 1
    return cmd

# ── Builtins ─────────────────────────────────────────────────────────────────

def builtin_cd(argv: list[str]) -> int:
    path = argv[1] if len(argv) > 1 else os.environ.get('HOME', '/')
    try:
        os.chdir(path)
    except OSError as e:
        print(f"cd: {e.strerror}: {path}", file=sys.stderr)
        return 1
    return 0


def builtin_export(argv: list[str]) -> int:
    for item in argv[1:]:
        if '=' in item:
            k, v = item.split('=', 1)
            os.environ[k] = v
        else:
            os.environ.setdefault(item, '')
    return 0


def builtin_echo(argv: list[str]) -> int:
    print(' '.join(argv[1:]))
    return 0


BUILTINS = {'cd': builtin_cd, 'export': builtin_export, 'echo': builtin_echo}

# ── Execution ────────────────────────────────────────────────────────────────

def exec_pipeline(cmds: list[Cmd]) -> int:
    """Fork/exec a pipeline; wait for all children and return last exit code."""
    if len(cmds) == 1 and cmds[0].argv[0] in BUILTINS:
        return _run_builtin(cmds[0])

    n = len(cmds)
    pids: list[int] = []
    pipes: list[tuple[int, int]] = []

    # Create n-1 pipes
    for _ in range(n - 1):
        pipes.append(os.pipe())

    for i, cmd in enumerate(cmds):
        pid = os.fork()
        if pid == 0:  # child
            # Connect pipe stdin
            if i > 0:
                os.dup2(pipes[i - 1][0], sys.stdin.fileno())
            # Connect pipe stdout
            if i < n - 1:
                os.dup2(pipes[i][1], sys.stdout.fileno())
            # Close all pipe fds in child
            for r, w in pipes:
                os.close(r); os.close(w)
            _apply_redirects(cmd)
            _exec_cmd(cmd)
        else:
            pids.append(pid)

    # Parent closes all pipe fds
    for r, w in pipes:
        os.close(r); os.close(w)

    # Wait for all children
    last_status = 0
    for pid in pids:
        _, status = os.waitpid(pid, 0)
        last_status = os.waitstatus_to_exitcode(status)

    return last_status


def _run_builtin(cmd: Cmd) -> int:
    saved_in, saved_out = sys.stdin, sys.stdout
    try:
        if cmd.stdin_file:
            sys.stdin = open(cmd.stdin_file)
        if cmd.stdout_file:
            sys.stdout = open(cmd.stdout_file, 'a' if cmd.append else 'w')
        return BUILTINS[cmd.argv[0]](cmd.argv)
    finally:
        if cmd.stdin_file and sys.stdin is not saved_in:
            sys.stdin.close(); sys.stdin = saved_in
        if cmd.stdout_file and sys.stdout is not saved_out:
            sys.stdout.close(); sys.stdout = saved_out


def _apply_redirects(cmd: Cmd) -> None:
    if cmd.stdin_file:
        fd = os.open(cmd.stdin_file, os.O_RDONLY)
        os.dup2(fd, 0); os.close(fd)
    if cmd.stdout_file:
        flags = os.O_WRONLY | os.O_CREAT | (os.O_APPEND if cmd.append else os.O_TRUNC)
        fd = os.open(cmd.stdout_file, flags, 0o644)
        os.dup2(fd, 1); os.close(fd)


def _exec_cmd(cmd: Cmd) -> None:
    """Replace current process with cmd. Only called inside fork'd child."""
    try:
        os.execvpe(cmd.argv[0], cmd.argv, os.environ)
    except FileNotFoundError:
        print(f"mini-shell: {cmd.argv[0]}: command not found", file=sys.stderr)
        sys.exit(127)
    except PermissionError:
        print(f"mini-shell: {cmd.argv[0]}: permission denied", file=sys.stderr)
        sys.exit(126)

# ── REPL ─────────────────────────────────────────────────────────────────────

def prompt() -> str:
    cwd = os.getcwd().replace(os.environ.get('HOME', ''), '~')
    return f'\033[1;32m{cwd}\033[0m $ '


def main() -> None:
    signal.signal(signal.SIGINT, signal.SIG_IGN)   # shell ignores Ctrl-C
    signal.signal(signal.SIGCHLD, signal.SIG_DFL)  # let waitpid work

    while True:
        try:
            line = input(prompt()).strip()
        except EOFError:
            print(); break
        except KeyboardInterrupt:
            print(); continue

        if not line or line.startswith('#'):
            continue
        if line in ('exit', 'quit'):
            break

        tokens = tokenize(line)
        if not tokens:
            continue

        pipelines = parse(tokens)
        for pipeline in pipelines:
            if pipeline:
                exec_pipeline(pipeline)


if __name__ == '__main__':
    main()
