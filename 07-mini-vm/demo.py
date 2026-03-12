#!/usr/bin/env python3
"""Demo for mini-vm."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from mini_vm import compile_source, disassemble, run_source

PROGRAM = """
def fib(n):
    if n:
        if n - 1:
            return fib(n - 1) + fib(n - 2)
    return n

def fact(n):
    acc = 1
    while n:
        acc = acc * n
        n = n - 1
    return acc

def sum_to(n):
    total = 0
    while n:
        total = total + n
        n = n - 1
    return total

print(fib(8))
print(fact(6))
print(sum_to(10))
"""


def main():
    print("mini-vm demo\n")
    program = compile_source(PROGRAM)
    print("disassembly:")
    print(disassemble(program))
    print("\noutput:")
    run_source(PROGRAM, show=False)


if __name__ == "__main__":
    main()
