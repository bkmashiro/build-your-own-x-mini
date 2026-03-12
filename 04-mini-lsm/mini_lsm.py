#!/usr/bin/env python3
"""
mini-lsm: A minimal LSM-tree in Python.

Implements:
  - sorted MemTable in memory
  - flush to immutable SSTable files
  - point get(key)
  - simple L0 -> L1 compaction
"""

from __future__ import annotations

import json
import os
from bisect import bisect_left


# ─────────────────────────────────────────────────────────────
# MemTable
# ─────────────────────────────────────────────────────────────
# LSM writes land in RAM first. We keep keys sorted so flushes can write an
# already ordered SSTable, which is what makes merge compaction simple.

class MemTable:
    """Sorted in-memory map."""

    def __init__(self):
        self.keys: list[str] = []
        self.data: dict[str, str] = {}

    def put(self, key: str, value: str):
        if key not in self.data:
            self.keys.insert(bisect_left(self.keys, key), key)
        self.data[key] = value

    def get(self, key: str) -> str | None:
        return self.data.get(key)

    def items(self) -> list[tuple[str, str]]:
        return [(key, self.data[key]) for key in self.keys]

    def clear(self):
        self.keys.clear()
        self.data.clear()

    def __len__(self) -> int:
        return len(self.keys)


# ─────────────────────────────────────────────────────────────
# SSTable helpers
# ─────────────────────────────────────────────────────────────
# Each SSTable is an immutable text file of sorted JSON lines:
#   {"key": "...", "value": "..."}

def write_sstable(path: str, items: list[tuple[str, str]]):
    """Write a sorted immutable SSTable."""
    with open(path, "w", encoding="utf-8") as f:
        for key, value in items:
            f.write(json.dumps({"key": key, "value": value}) + "\n")


def read_sstable(path: str) -> list[tuple[str, str]]:
    """Read all records from an SSTable."""
    items = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            row = json.loads(line)
            items.append((row["key"], row["value"]))
    return items


def get_from_sstable(path: str, key: str) -> str | None:
    """Linear point lookup inside one SSTable."""
    with open(path, encoding="utf-8") as f:
        for line in f:
            row = json.loads(line)
            if row["key"] == key:
                return row["value"]
    return None


# ─────────────────────────────────────────────────────────────
# LSM Tree
# ─────────────────────────────────────────────────────────────
# Read order:
#   MemTable -> newest L0 SSTable -> older L0 SSTables -> L1 SSTable
# Newer data shadows older data. Compaction merges everything into one L1 file.

class MiniLSM:
    """Minimal two-level LSM tree."""

    def __init__(self, root: str = "data", memtable_limit: int = 4):
        self.root = root
        self.memtable_limit = memtable_limit
        self.memtable = MemTable()
        self.l0_dir = os.path.join(root, "L0")
        self.l1_dir = os.path.join(root, "L1")
        os.makedirs(self.l0_dir, exist_ok=True)
        os.makedirs(self.l1_dir, exist_ok=True)
        self.next_seq = self._next_sequence()

    def put(self, key: str, value: str):
        """Insert or overwrite a key."""
        self.memtable.put(key, value)
        if len(self.memtable) >= self.memtable_limit:
            self.flush()

    def get(self, key: str) -> str | None:
        """Point lookup across MemTable, L0, and L1."""
        value = self.memtable.get(key)
        if value is not None:
            return value
        for path in reversed(self.level_files(0)):  # newest L0 first
            value = get_from_sstable(path, key)
            if value is not None:
                return value
        for path in reversed(self.level_files(1)):
            value = get_from_sstable(path, key)
            if value is not None:
                return value
        return None

    def flush(self):
        """Freeze the MemTable as a new immutable L0 SSTable."""
        if not self.memtable:
            return
        path = os.path.join(self.l0_dir, f"{self.next_seq:06d}.sst")
        write_sstable(path, self.memtable.items())
        self.next_seq += 1
        self.memtable.clear()

    def compact(self):
        """Merge all L0 SSTables and current L1 into one new L1 SSTable."""
        l0_files = self.level_files(0)
        if not l0_files:
            return
        l1_files = self.level_files(1)
        merged: dict[str, str] = {}
        for path in l1_files:  # base layer: oldest data
            for key, value in read_sstable(path):
                merged[key] = value
        for path in l0_files:  # newer L0 files overwrite older values
            for key, value in read_sstable(path):
                merged[key] = value
        out = os.path.join(self.l1_dir, f"{self.next_seq:06d}.sst")
        write_sstable(out, sorted(merged.items()))
        self.next_seq += 1
        for path in l1_files:
            os.remove(path)
        for path in l0_files:
            os.remove(path)

    def level_files(self, level: int) -> list[str]:
        """List SSTables in one level ordered by creation sequence."""
        directory = self.l0_dir if level == 0 else self.l1_dir
        return sorted(
            os.path.join(directory, name)
            for name in os.listdir(directory)
            if name.endswith(".sst")
        )

    def _next_sequence(self) -> int:
        existing = []
        for level in [self.l0_dir, self.l1_dir]:
            if not os.path.exists(level):
                continue
            for name in os.listdir(level):
                if name.endswith(".sst"):
                    existing.append(int(name.split(".", 1)[0]))
        return max(existing, default=0) + 1


if __name__ == "__main__":
    db = MiniLSM("demo-data", memtable_limit=3)
    for k, v in [("apple", "1"), ("banana", "2"), ("apple", "3"), ("cat", "4")]:
        db.put(k, v)
    db.flush()
    print("apple =", db.get("apple"))
    print("banana =", db.get("banana"))
    db.compact()
    print("L0 files:", db.level_files(0))
    print("L1 files:", db.level_files(1))
