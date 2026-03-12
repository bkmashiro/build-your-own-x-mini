#!/usr/bin/env python3
"""Interactive demo for mini-regex."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from mini_regex import compile


def show(pattern: str, text: str):
    regex = compile(pattern)
    found = regex.search(text)
    whole = regex.fullmatch(text)
    print(f"pattern: {pattern!r}")
    print(f"text:    {text!r}")
    print(f"search:  {found.group(0)!r} span={found.span(0)} groups={found.groups()}" if found else "search:  no match")
    print(
        f"full:    {whole.group(0)!r} span={whole.span(0)} groups={whole.groups()}"
        if whole
        else "full:    no match"
    )
    print()


def main():
    print("mini-regex demo\n")
    for pattern, text in [
        ("ab*c", "xxabbbczz"),
        ("h(el+)o", "helllo"),
        ("colou?r", "color"),
        ("a[bc]+d", "zzabcbcd"),
        ("^(cat|dog)$", "dog"),
    ]:
        show(pattern, text)

    print("Enter pattern and text to try your own examples. Empty pattern exits.\n")
    while True:
        pattern = input("pattern> ").strip()
        if not pattern:
            break
        text = input("text> ")
        show(pattern, text)


if __name__ == "__main__":
    main()
