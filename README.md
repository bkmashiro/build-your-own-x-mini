# build-your-own-x-mini

[![GitHub stars](https://img.shields.io/github/stars/bkmashiro/build-your-own-x-mini?style=social)](https://github.com/bkmashiro/build-your-own-x-mini)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Minimal, readable implementations of real systems — each under 200 lines.

**[⭐ Star on GitHub](https://github.com/bkmashiro/build-your-own-x-mini)** if you find this useful!

Not production code. Enough to understand *how it works*.

## Projects

| # | Project | Lines | Key Concepts | Status |
|---|---------|-------|--------------|--------|
| 01 | [mini-redis](./projects/mini-redis/) | ~180 | RESP2 protocol, asyncio, TTL | ✅ |
| 02 | [mini-git](./02-mini-git/) | ~190 | SHA1 hashing, zlib, content-addressable storage | ✅ |
| 03 | [mini-http](./03-mini-http/) | ~190 | HTTP/1.1 parsing, socket API, routing, threading | ✅ |

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
