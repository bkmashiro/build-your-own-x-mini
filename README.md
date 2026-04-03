<div align="center">

# 🔧 build-your-own-x-mini

**Minimal, readable implementations of real systems — each under 200 lines.**

[![GitHub stars](https://img.shields.io/github/stars/bkmashiro/build-your-own-x-mini?style=for-the-badge&logo=github&color=FFD700)](https://github.com/bkmashiro/build-your-own-x-mini)
[![MIT License](https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge)](LICENSE)

**English** | [中文](README.zh.md)

> Not production code. Enough to understand *how it works*.
> New project every Wednesday, auto-generated. **30 projects** and counting.

</div>

---

## 📦 Projects

### Systems & Infrastructure (Python)

| # | Project | Lines | Difficulty | Key Concepts |
|:--|:--------|:------|:-----------|:-------------|
| 01 | [mini-redis](./01-mini-redis/README.md) ([中文](./01-mini-redis/README.zh.md)) | ~180 | ⭐⭐ | RESP2 protocol, asyncio, TTL |
| 02 | [mini-git](./02-mini-git/README.md) ([中文](./02-mini-git/README.zh.md)) | ~190 | ⭐⭐ | SHA1 hashing, zlib, content-addressable storage |
| 03 | [mini-http](./03-mini-http/README.md) ([中文](./03-mini-http/README.zh.md)) | ~190 | ⭐⭐ | HTTP/1.1 parsing, socket API, routing, threading |
| 04 | [mini-lsm](./04-mini-lsm/README.md) ([中文](./04-mini-lsm/README.zh.md)) | ~180 | ⭐⭐⭐ | MemTable, SSTables, point reads, compaction |
| 05 | [mini-raft](./05-mini-raft/README.md) ([中文](./05-mini-raft/README.zh.md)) | ~290 | ⭐⭐⭐ | Leader election, terms, log replication, majority commit |
| 06 | [mini-regex](./06-mini-regex/README.md) ([中文](./06-mini-regex/README.zh.md)) | ~168 | ⭐⭐⭐ | NFA construction, Thompson's algorithm, epsilon-closure |
| 07 | [mini-vm](./07-mini-vm/README.md) ([中文](./07-mini-vm/README.zh.md)) | ~160 | ⭐⭐ | Stack bytecode, compiler, call frames, disassembly |
| 08 | [mini-malloc](./08-mini-malloc/README.md) ([中文](./08-mini-malloc/README.zh.md)) | ~110 | ⭐⭐ | Free list, first-fit, realloc, coalescing |
| 09 | [mini-tls](./09-mini-tls/README.md) ([中文](./09-mini-tls/README.zh.md)) | ~165 | ⭐⭐⭐ | TLS 1.3 handshake, key schedule, AES-GCM, certificates |
| 10 | [mini-db](./10-mini-db/README.md) ([中文](./10-mini-db/README.zh.md)) | ~172 | ⭐⭐ | SQL parser, WHERE executor, sorted index, in-memory tables |
| 11 | [mini-shell](./11-mini-shell/README.md) ([中文](./11-mini-shell/README.zh.md)) | ~190 | ⭐⭐ | Tokenizer, fork/exec, pipes, redirects, builtins |
| 30 | [mini-neural-net](./30-mini-neural-net/README.md) ([中文](./30-mini-neural-net/README.zh.md)) | ~195 | ⭐⭐ | Forward pass, backprop, chain rule, SGD, XOR demo |

### Frontend & Language Runtime (TypeScript)

| # | Project | Lines | Difficulty | Key Concepts |
|:--|:--------|:------|:-----------|:-------------|
| 12 | [mini-json-parser](./12-mini-json-parser/README.md) | ~493 | ⭐⭐ | Lexer, recursive descent parser, Unicode escapes, error positions |
| 13 | [mini-lru-cache](./13-mini-lru-cache/README.md) | ~162 | ⭐ | HashMap + DLL, O(1) get/put, sentinel nodes, eviction |
| 14 | [mini-event-loop](./14-mini-event-loop/README.md) | ~369 | ⭐⭐ | Macrotask/microtask queues, virtual clock, execution trace |
| 15 | [mini-promise](./15-mini-promise/README.md) | ~296 | ⭐⭐⭐ | Promise/A+ spec, state machine, chaining, `.all/.race/.any` |
| 16 | [mini-bundler](./16-mini-bundler/README.md) | ~580 | ⭐⭐⭐ | ES module parsing, dependency graph, circular detection, IIFE output |
| 17 | [mini-router](./17-mini-router/README.md) | ~368 | ⭐⭐ | Hash/history modes, route params, nested routes, guards |
| 18 | [mini-react](./18-mini-react/README.md) | ~380 | ⭐⭐⭐ | VNode tree, `useState`, `useEffect`, diff algorithm, DOM patching |
| 19 | [mini-vdom](./19-mini-vdom/README.md) | ~331 | ⭐⭐⭐ | Hyperscript factory, mount/patch, keyed reconciliation, LIS |
| 20 | [mini-fiber](./20-mini-fiber/README.md) | ~358 | ⭐⭐⭐ | Fiber nodes, priority queue, time-slicing, interruptible rendering |
| 21 | [mini-observable](./21-mini-observable/README.md) | ~348 | ⭐⭐ | Observable, pipe, operators (map/filter/take/debounce), Subject |
| 22 | [mini-state](./22-mini-state/README.md) | ~182 | ⭐⭐ | Redux-style `createStore`, middleware, `combineReducers` |
| 23 | [mini-di](./23-mini-di/README.md) ([中文](./23-mini-di/README.zh.md)) | ~188 | ⭐⭐ | `@Injectable` decorator, typed tokens, singleton/transient scope |
| 24 | [mini-scheduler](./24-mini-scheduler/README.md) | ~338 | ⭐⭐ | Priority queue, delayed execution, cancellation, cooperative scheduling |
| 25 | [mini-proxy](./25-mini-proxy/README.md) | ~205 | ⭐⭐ | Proxy-based reactivity, `reactive()`, `ref()`, `computed()`, `effect()` |
| 26 | [mini-compiler](./26-mini-compiler/README.md) | ~339 | ⭐⭐⭐ | Lisp → C-style, tokenizer, parser, AST, code generation |
| 27 | [mini-pubsub](./27-mini-pubsub/README.md) | ~383 | ⭐⭐ | Topic-based messaging, wildcard subscriptions, message history |
| 28 | [mini-orm](./28-mini-orm/README.md) | ~261 | ⭐⭐ | `@Entity/@Column` decorators, CRUD, in-memory storage |
| 29 | [mini-validator](./29-mini-validator/README.md) | ~219 | ⭐⭐ | Decorator-based validation, nested objects, custom validators |

### Incubator Projects

| # | Project | Lines | Key Concepts | Tests |
|:--|:--------|:------|:-------------|:------|
| 12 | [mini-neural-net](./projects/12-mini-neural-net/README.md) ([中文](./projects/12-mini-neural-net/README.zh.md)) | ~80 | Forward pass, backprop, SGD, XOR demo | — |
| 13 | [mini-docker](./projects/13-mini-docker/README.md) ([中文](./projects/13-mini-docker/README.zh.md)) | ~110 | Namespaces, cgroup v2, overlayfs, chroot | — |
| 14 | [mini-physics](./projects/14-mini-physics/) | ~155 | Rigid body, AABB collision, impulse resolution, 2D sim | 4 |
| 15 | [mini-lisp](./projects/15-mini-lisp/) | ~148 | Tokenizer, reader, eval, closures, tail-call optimization | 4 |
| 16 | [mini-browser](./projects/16-mini-browser/) | ~160 | HTML tokenizer, CSS box model, block layout, terminal paint | demo |
| 17 | [mini-bitcoin](./projects/17-mini-bitcoin/) | ~90 | SHA256, Merkle tree, proof-of-work, chain validation | demo |
| 18 | [mini-torrent](./projects/18-mini-torrent/) | ~130 | DHT, peer wire protocol, piece selection, seeding | demo |
| 19 | [mini-ray-tracer](./projects/19-mini-ray-tracer/) | ~135 | Ray-sphere intersection, BVH, shadows, reflections | demo |
| 20 | [mini-search](./projects/20-mini-search/) | ~80 | Inverted index, TF-IDF, BM25, query ranking | demo |
| 21 | [mini-os](./projects/21-mini-os/) | ~156 | Bootloader flow, interrupts, memory paging, round-robin scheduler | demo |
| 22 | [mini-riscv](./projects/22-mini-riscv/) | ~184 | RV32I decode, integer ALU, IF/ID/EX/MEM/WB pipeline, branch flush | demo |
| 24 | [mini-signals](./projects/24-mini-signals/) | ~210 | Signals, effects, memos, batching | 6 |
| 25 | [mini-compiler](./projects/25-mini-compiler/) | ~191 | Lexer, recursive descent parser, AST, stack code generation | demo |
| 27 | [mini-blockchain](./projects/27-mini-blockchain/) | ~145 | Blocks, SHA256, proof-of-work, account balances, chain validation | demo |
| 27 | [mini-ioc](./projects/27-mini-ioc/) | ~205 | Typed tokens, scopes, disposal | 6 |

**Difficulty**: ⭐ Beginner — ⭐⭐ Intermediate — ⭐⭐⭐ Advanced

---

## 🎯 Philosophy

- One file, one concept
- Inline comments explain every non-obvious decision
- Runnable demo included
- **Bilingual analysis** — full English write-up + 完整中文解析

---

## 📄 License

MIT © [bkmashiro](https://github.com/bkmashiro)
