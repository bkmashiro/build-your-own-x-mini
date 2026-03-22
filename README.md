<div align="center">

# 🔧 build-your-own-x-mini

**Minimal, readable implementations of real systems — each under 500 lines.**

[![GitHub stars](https://img.shields.io/github/stars/bkmashiro/build-your-own-x-mini?style=for-the-badge&logo=github&color=FFD700)](https://github.com/bkmashiro/build-your-own-x-mini)
[![MIT License](https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge)](LICENSE)

**English** | [中文](README.zh.md)

> Not production code. Enough to understand *how it works*.  
> New project every Wednesday, auto-generated.

</div>

---

## 📦 Projects

### Core Systems (Python)

| # | Project | Lines | Key Concepts | Tests |
|:--|:--------|:------|:-------------|:------|
| 01 | [mini-redis](./01-mini-redis/) | ~320 | RESP2 protocol, asyncio, TTL | ✅ |
| 02 | [mini-git](./02-mini-git/) | ~280 | SHA1 hashing, zlib, content-addressable storage | ✅ |
| 03 | [mini-http](./03-mini-http/) | ~340 | HTTP/1.1 parsing, socket API, routing | ✅ |
| 04 | [mini-lsm](./04-mini-lsm/) | ~240 | MemTable, SSTables, compaction | ✅ |
| 05 | [mini-raft](./05-mini-raft/) | ~350 | leader election, log replication | ✅ |
| 06 | [mini-regex](./06-mini-regex/) | ~170 | NFA construction, Thompson's algorithm | ✅ |
| 07 | [mini-vm](./07-mini-vm/) | ~160 | stack bytecode, compiler, call frames | ✅ |
| 08 | [mini-malloc](./08-mini-malloc/) | ~110 | free list, first-fit, coalescing | ✅ |
| 09 | [mini-tls](./09-mini-tls/) | ~165 | TLS 1.3 handshake, AES-GCM | ✅ |
| 10 | [mini-db](./10-mini-db/) | ~170 | SQL parser, WHERE executor, index | ✅ |
| 11 | [mini-shell](./11-mini-shell/) | ~190 | fork/exec, pipes, redirects | ✅ |

### Frontend & JavaScript Runtime (TypeScript)

| # | Project | Lines | Key Concepts | Tests |
|:--|:--------|:------|:-------------|:------|
| 12 | [mini-json-parser](./12-mini-json-parser/) | ~493 | recursive descent, AST, IEEE-754 | 33 |
| 13 | [mini-lru-cache](./13-mini-lru-cache/) | ~162 | HashMap + doubly linked list, O(1) | 25 |
| 14 | [mini-event-loop](./14-mini-event-loop/) | ~369 | single-threaded async, microtask queue | 26 |
| 15 | [mini-promise](./15-mini-promise/) | ~296 | Promise/A+ spec, chaining, thenable | 46 |
| 16 | [mini-bundler](./16-mini-bundler/) | ~580 | dependency graph, circular detection | 31 |
| 17 | [mini-router](./17-mini-router/) | ~368 | path matching, wildcards, guards | 30 |
| 18 | [mini-react](./18-mini-react/) | ~380 | createElement, render, hooks | 25 |
| 19 | [mini-vdom](./19-mini-vdom/) | ~331 | diffing, patching, keyed children | 26 |
| 20 | [mini-fiber](./20-mini-fiber/) | ~358 | work loop, time slicing, lanes | 27 |
| 21 | [mini-observable](./21-mini-observable/) | ~348 | hot/cold, operators, backpressure | 24 |
| 22 | [mini-state](./22-mini-state/) | ~182 | atom/selector, derived state | 14 |

### Patterns & Tooling (TypeScript)

| # | Project | Lines | Key Concepts | Tests |
|:--|:--------|:------|:-------------|:------|
| 23 | [mini-di](./23-mini-di/) | ~188 | IoC container, decorators, scopes | 7 |
| 25 | [mini-proxy](./25-mini-proxy/) | ~205 | ES Proxy, reactive, interceptors | 15 |
| 26 | [mini-compiler](./26-mini-compiler/) | ~339 | lexer, parser, AST, codegen | 28 |
| 28 | [mini-orm](./28-mini-orm/) | ~261 | decorators, query builder, relations | 12 |
| 29 | [mini-validator](./29-mini-validator/) | ~219 | schema DSL, type inference, custom rules | 18 |

---

## 🎯 Philosophy

- **One folder, one concept** — focused implementation
- **Inline comments** — explain every non-obvious decision
- **Tests included** — runnable specs for each project
- **Bilingual docs** — English + 中文

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/bkmashiro/build-your-own-x-mini.git
cd build-your-own-x-mini

# Run a TypeScript project
cd 15-mini-promise
pnpm install
pnpm test

# Run a Python project
cd 01-mini-redis
python -m pytest
```

---

## 🗺️ Roadmap

### Completed ✅
- [x] 01-11: Core systems (Python)
- [x] 12-22: Frontend & JS runtime (TypeScript)
- [x] 23-29: Patterns & tooling (TypeScript)

### Planned
- [ ] 24-mini-signals — fine-grained reactivity
- [ ] 27-mini-ioc — inversion of control
- [ ] 30-mini-graphql — schema, resolvers, execution
- [ ] 31-mini-wasm — binary format, stack machine
- [ ] 32-mini-lisp — s-expressions, eval/apply

---

## 📊 Stats

| Metric | Value |
|--------|-------|
| Total Projects | 27 |
| Total Lines | ~7,500 |
| Total Tests | ~400 |
| Languages | Python, TypeScript |

---

## 📄 License

MIT © [bkmashiro](https://github.com/bkmashiro)
