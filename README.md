# build-your-own-x-mini

> Minimal, readable implementations of real systems — each under 200 lines.

Not production code. Enough to understand *how it works*.

## Projects

| # | Project | Lines | Key Concepts | Status |
|---|---------|-------|--------------|--------|
| 01 | [mini-redis](./projects/mini-redis/) | ~180 | RESP protocol, key-value store, TTL | ✅ |

## Philosophy

- One file, one concept
- Inline comments explain every non-obvious decision
- Runnable demo included
- Bilingual README (English + 中文)

## Roadmap

- mini-redis — RESP protocol, SET/GET/EXPIRE, persistence
- mini-git — content-addressable storage, commits, branches
- mini-http — HTTP/1.1, routing, chunked encoding
- mini-lsm — memtable, SSTable, compaction
- mini-raft — leader election, log replication
- mini-regex — NFA, Thompson's construction
- mini-vm — stack VM, bytecode interpreter
- mini-malloc — free list, coalescing, slab allocator
