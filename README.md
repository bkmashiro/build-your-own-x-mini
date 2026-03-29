<div align="center">

# 🔧 build-your-own-x-mini

**Minimal, readable implementations of real systems — each under 200 lines.**

[![GitHub stars](https://img.shields.io/github/stars/bkmashiro/build-your-own-x-mini?style=for-the-badge&logo=github&color=FFD700)](https://github.com/bkmashiro/build-your-own-x-mini)
[![MIT License](https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge)](LICENSE)

**English** | [中文](README.zh.md)

> Not production code. Enough to understand *how it works*.  
> New project every Wednesday, auto-generated.

</div>

---

## 📦 Projects

| # | Project | Lines | Key Concepts | Analysis |
|:--|:--------|:------|:-------------|:---------|
| 01 | [mini-redis](./01-mini-redis/README.md) ([中文](./01-mini-redis/README.zh.md)) | ~180 | RESP2 protocol, asyncio, TTL | ✅ |
| 02 | [mini-git](./02-mini-git/README.md) ([中文](./02-mini-git/README.zh.md)) | ~190 | SHA1 hashing, zlib, content-addressable storage | ✅ |
| 03 | [mini-http](./03-mini-http/README.md) ([中文](./03-mini-http/README.zh.md)) | ~190 | HTTP/1.1 parsing, socket API, routing, threading | ✅ |
| 04 | [mini-lsm](./04-mini-lsm/README.md) ([中文](./04-mini-lsm/README.zh.md)) | ~180 | MemTable, SSTables, point reads, compaction | ✅ |
| 05 | [mini-raft](./05-mini-raft/README.md) ([中文](./05-mini-raft/README.zh.md)) | ~290 | leader election, terms, log replication, majority commit | ✅ |
| 06 | [mini-regex](./06-mini-regex/README.md) ([中文](./06-mini-regex/README.zh.md)) | ~168 | NFA construction, Thompson's algorithm, epsilon-closure, backtracking | ✅ |
| 07 | [mini-vm](./07-mini-vm/README.md) ([中文](./07-mini-vm/README.zh.md)) | ~160 | stack bytecode, compiler, call frames, disassembly | ✅ |
| 08 | [mini-malloc](./08-mini-malloc/README.md) ([中文](./08-mini-malloc/README.zh.md)) | ~110 | free list, first-fit, realloc, coalescing | ✅ |
| 09 | [mini-tls](./09-mini-tls/README.md) ([中文](./09-mini-tls/README.zh.md)) | ~165 | TLS 1.3 handshake, key schedule, AES-GCM, certificates | ✅ |
| 10 | [mini-db](./10-mini-db/README.md) ([中文](./10-mini-db/README.zh.md)) | ~172 | SQL parser, WHERE executor, sorted index, in-memory tables | ✅ |
| 11 | [mini-shell](./11-mini-shell/README.md) ([中文](./11-mini-shell/README.zh.md)) | ~190 | tokenizer, fork/exec, pipes, redirects, builtins | ✅ |
| 12 | [mini-neural-net](./projects/12-mini-neural-net/README.md) ([中文](./projects/12-mini-neural-net/README.zh.md)) | ~80 | forward pass, backprop, SGD, XOR demo | ✅ |
| 13 | [mini-docker](./projects/13-mini-docker/README.md) ([中文](./projects/13-mini-docker/README.zh.md)) | ~110 | namespaces, cgroup v2, overlayfs, chroot | ✅ |

### Incubator Projects

| # | Project | Lines | Key Concepts | Tests |
|:--|:--------|:------|:-------------|:------|
| 24 | [mini-signals](./projects/24-mini-signals/) | ~210 | signals, effects, memos, batching | 6 |
| 27 | [mini-ioc](./projects/27-mini-ioc/) | ~205 | typed tokens, scopes, disposal | 6 |

---

## 🎯 Philosophy

- One file, one concept
- Inline comments explain every non-obvious decision
- Runnable demo included
- **Bilingual analysis** — full English write-up + 完整中文解析

---

## 🗺️ Roadmap

- [x] mini-lsm — LSM tree, memtable, SSTables
- [x] mini-raft — leader election, log replication
- [x] mini-regex — NFA construction, backtracking
- [x] mini-vm — bytecode interpreter, stack machine
- [x] mini-malloc — free list, first-fit allocator
- [x] mini-tls — record layer, handshake, certificates
- [x] mini-db — SQL parsing, planning, storage
- [x] projects/12-mini-neural-net — forward pass, backprop, SGD, XOR demo
- [ ] 12-mini-json-parser — recursive descent parser, AST, IEEE-754
- [ ] 13-mini-lru-cache — HashMap + doubly linked list, O(1) get/put
- [ ] 14-mini-event-loop — single-threaded async, epoll/kqueue, microtask queue
- [ ] 15-mini-actor — actor model, message passing, supervision tree
- [ ] 16-mini-rpc — binary protocol, serialization, connection pooling
- [ ] 17-mini-bloom-filter — probabilistic set, false positive rate, bit array
- [ ] 18-mini-b-tree — balanced tree, node split/merge, range queries
- [ ] 19-mini-wal — write-ahead log, crash recovery, log replay
- [ ] 20-mini-pubsub — publish-subscribe, topic routing, backpressure

---

## 📄 License

MIT © [bkmashiro](https://github.com/bkmashiro)
