"""
demo.py — smoke-test mini-shell programmatically (no TTY needed).
Exercises: tokenizer, redirects, pipes, builtins, env expansion, semicolon.
"""

import os
import sys
import tempfile

# Make sure we can import our implementation
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from mini_shell import tokenize, parse, exec_pipeline

SEP = '─' * 60

def run(line: str, expect_exit: int = 0) -> None:
    tokens = tokenize(line)
    pipelines = parse(tokens)
    exit_code = 0
    for pipeline in pipelines:
        if pipeline:
            exit_code = exec_pipeline(pipeline)
    status = '✓' if exit_code == expect_exit else f'✗ (got {exit_code})'
    print(f"  [{status}] {line!r}")


def section(title: str) -> None:
    print(f"\n{SEP}\n  {title}\n{SEP}")


# ── Tokenizer Demo ───────────────────────────────────────────────────────────
section("1. Tokenizer")
examples = [
    'echo hello world',
    'echo "hello world"',
    "echo 'it\\'s quoted'",
    'echo $HOME',
    'ls -la | grep py',
    'cat file.txt > out.txt 2>&1',
    'echo a; echo b',
    'echo >>append.log line',
]
for ex in examples:
    tokens = tokenize(ex)
    print(f"  {ex!r:45s}  →  {tokens}")


# ── Redirect Test ────────────────────────────────────────────────────────────
section("2. Redirects: echo > /tmp, cat > out, cat < in | tr")
with tempfile.TemporaryDirectory() as td:
    # Write to file
    line = f'echo "mini-shell redirect test" > {td}/hello.txt'
    run(line)
    # Read it back
    with open(f'{td}/hello.txt') as f:
        print(f"  File contents: {f.read().strip()!r}")

    # Append
    run(f'echo "second line" >> {td}/hello.txt')
    with open(f'{td}/hello.txt') as f:
        lines = f.read().splitlines()
    print(f"  After append ({len(lines)} lines): {lines}")

    # Pipe: cat file | tr a-z A-Z
    run(f'cat {td}/hello.txt | tr a-z A-Z')


# ── Pipeline Test ────────────────────────────────────────────────────────────
section("3. Pipelines")
run("echo 'the quick brown fox' | tr ' ' '\\n' | sort")
run("printf 'c\\nb\\na\\n' | sort | head -2")
run("echo hello | cat | cat | cat")


# ── Builtins ─────────────────────────────────────────────────────────────────
section("4. Builtins: cd / export / echo")
original = os.getcwd()
run(f"cd /tmp")
print(f"  cwd is now: {os.getcwd()}")
run(f"cd {original}")
print(f"  cwd restored: {os.getcwd()}")

run("export MINI_TEST=hello")
print(f"  MINI_TEST={os.environ.get('MINI_TEST', '(not set)')}")

run("echo $MINI_TEST world")


# ── Semicolon (multiple commands) ────────────────────────────────────────────
section("5. Semicolons")
run("echo first; echo second; echo third")


# ── Error Cases ──────────────────────────────────────────────────────────────
section("6. Error handling (expected non-zero exits)")
run("no_such_command_xyz", expect_exit=127)
run("cat /no/such/file.txt", expect_exit=1)


section("Done ✓")
