#!/usr/bin/env python3
"""Demo for mini-malloc."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from mini_malloc import MiniMalloc


def show(heap, label):
    print(f"{label}: {heap.layout()}")


def main():
    heap = MiniMalloc(128)
    print("mini-malloc demo\n")
    show(heap, "start")

    a = heap.malloc(16)
    b = heap.malloc(12)
    c = heap.malloc(20)
    show(heap, "after malloc a/b/c")

    heap.free(b)
    show(heap, "free b")

    d = heap.malloc(10)
    show(heap, "first-fit alloc d")

    heap.free(a)
    heap.free(d)
    show(heap, "free a + d (coalesced)")

    heap.write(c, b"raft-log")
    c = heap.realloc(c, 28)
    show(heap, "realloc c -> 28")
    print("c payload:", heap.read(c, 8).decode())

    heap.free(c)
    show(heap, "free c")


if __name__ == "__main__":
    main()
