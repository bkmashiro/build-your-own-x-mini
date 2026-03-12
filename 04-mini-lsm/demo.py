#!/usr/bin/env python3
"""Runnable demo for mini-lsm."""

import os
import shutil
import tempfile

from mini_lsm import MiniLSM, read_sstable


def check(desc: str, ok: bool):
    print(f"  {'✓' if ok else '✗'} {desc}")
    return int(ok)


def main():
    workdir = tempfile.mkdtemp(prefix="mini-lsm-")
    passed = 0
    total = 0
    try:
        db = MiniLSM(workdir, memtable_limit=2)

        print("\nmini-lsm demo\n")

        db.put("banana", "yellow")
        db.put("apple", "red")  # flush #1
        l0_files = db.level_files(0)
        total += 2
        passed += check("flush creates one L0 SSTable", len(l0_files) == 1)
        passed += check(
            "SSTable is sorted by key",
            [k for k, _ in read_sstable(l0_files[0])] == ["apple", "banana"],
        )

        db.put("banana", "green")
        db.put("pear", "green")  # flush #2
        total += 3
        passed += check("second flush creates another L0 SSTable", len(db.level_files(0)) == 2)
        passed += check("get returns newest value from L0", db.get("banana") == "green")
        passed += check("get returns missing key as None", db.get("missing") is None)

        db.put("orange", "orange")
        total += 1
        passed += check("get reads unflushed MemTable values", db.get("orange") == "orange")

        db.flush()
        db.compact()
        total += 4
        passed += check("compaction clears L0", len(db.level_files(0)) == 0)
        passed += check("compaction produces one L1 file", len(db.level_files(1)) == 1)
        passed += check("get still works after compaction", db.get("banana") == "green")
        passed += check("newest value survives merge", db.get("apple") == "red")

        print(f"\n{passed}/{total} checks passed")
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    main()
