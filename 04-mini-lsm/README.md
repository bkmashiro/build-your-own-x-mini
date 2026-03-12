# 04 — mini-lsm

> A minimal LSM-tree in pure Python — ~180 lines.

## What we build

A tiny two-level LSM-tree with a sorted MemTable, immutable SSTable files, point reads, and L0 -> L1 compaction.

## How an LSM-tree works

### Write path

1. New writes go into the **MemTable** in RAM.
2. Once the MemTable reaches a size limit, it is flushed as a sorted immutable **SSTable** file in `L0`.
3. More flushes create more `L0` files.

### Read path

Point lookups check newer data first:

```
MemTable -> newest L0 SSTable -> older L0 SSTables -> L1 SSTable
```

That ordering is what makes overwrites work without editing old files.

### Compaction

Compaction merges multiple `L0` SSTables into one `L1` SSTable:

- read older files first
- let newer entries overwrite older ones
- write one new sorted file
- delete the old files

This is the core LSM idea: **fast writes now, merge later**.

## Usage

```bash
python3 demo.py
```

### As a library

```python
from mini_lsm import MiniLSM

db = MiniLSM("data", memtable_limit=3)
db.put("apple", "1")
db.put("banana", "2")
db.put("apple", "3")

db.flush()
print(db.get("apple"))  # 3

db.compact()
```

## What we skip

- Delete tombstones
- Bloom filters
- Binary search indexes / sparse indexes
- Range scans and iterators
- Write-ahead log (WAL)
- Multi-level compaction strategies beyond `L0 -> L1`
- Crash recovery / checksums / manifests

---

## 中文摘要

mini-lsm 用不到 200 行 Python 实现了一个最小可运行的 LSM 树。

**核心概念：**
- **MemTable**：写入先落在内存里的有序映射
- **SSTable**：刷盘后生成不可变、有序文件
- **读路径**：按“新到旧”的顺序查找，保证覆盖写生效
- **Compaction**：把多个 `L0` 文件合并成一个 `L1` 文件，减少读放大

**和真实 LSM 数据库的差距：** 没有 WAL、没有删除标记、没有 Bloom Filter、没有更复杂的多层压缩策略。但写入、刷盘、点查找、分层合并这些核心机制已经完整展示出来了。
