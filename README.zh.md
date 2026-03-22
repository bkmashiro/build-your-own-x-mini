<div align="center">

# 🔧 build-your-own-x-mini

**极简、可读的系统实现 — 每个项目不超过 500 行**

[![GitHub stars](https://img.shields.io/github/stars/bkmashiro/build-your-own-x-mini?style=for-the-badge&logo=github&color=FFD700)](https://github.com/bkmashiro/build-your-own-x-mini)
[![MIT License](https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge)](LICENSE)

[English](README.md) | **中文**

> 不是生产代码，但足以理解 *它是怎么工作的*。  
> 每周三更新一个新项目。

</div>

---

## 📦 项目列表

### 核心系统 (Python)

| # | 项目 | 代码行 | 核心概念 | 测试 |
|:--|:-----|:-------|:---------|:-----|
| 01 | [mini-redis](./01-mini-redis/) | ~320 | RESP2 协议、asyncio、TTL | ✅ |
| 02 | [mini-git](./02-mini-git/) | ~280 | SHA1 哈希、zlib、内容寻址存储 | ✅ |
| 03 | [mini-http](./03-mini-http/) | ~340 | HTTP/1.1 解析、socket API、路由 | ✅ |
| 04 | [mini-lsm](./04-mini-lsm/) | ~240 | MemTable、SSTables、压缩合并 | ✅ |
| 05 | [mini-raft](./05-mini-raft/) | ~350 | 领导选举、日志复制 | ✅ |
| 06 | [mini-regex](./06-mini-regex/) | ~170 | NFA 构造、Thompson 算法 | ✅ |
| 07 | [mini-vm](./07-mini-vm/) | ~160 | 栈式字节码、编译器、调用帧 | ✅ |
| 08 | [mini-malloc](./08-mini-malloc/) | ~110 | 空闲链表、首次适配、合并 | ✅ |
| 09 | [mini-tls](./09-mini-tls/) | ~165 | TLS 1.3 握手、AES-GCM | ✅ |
| 10 | [mini-db](./10-mini-db/) | ~170 | SQL 解析器、WHERE 执行、索引 | ✅ |
| 11 | [mini-shell](./11-mini-shell/) | ~190 | fork/exec、管道、重定向 | ✅ |

### 前端 & JavaScript 运行时 (TypeScript)

| # | 项目 | 代码行 | 核心概念 | 测试数 |
|:--|:-----|:-------|:---------|:-------|
| 12 | [mini-json-parser](./12-mini-json-parser/) | ~493 | 递归下降、AST、IEEE-754 | 33 |
| 13 | [mini-lru-cache](./13-mini-lru-cache/) | ~162 | HashMap + 双向链表、O(1) | 25 |
| 14 | [mini-event-loop](./14-mini-event-loop/) | ~369 | 单线程异步、微任务队列 | 26 |
| 15 | [mini-promise](./15-mini-promise/) | ~296 | Promise/A+ 规范、链式调用 | 46 |
| 16 | [mini-bundler](./16-mini-bundler/) | ~580 | 依赖图、循环检测 | 31 |
| 17 | [mini-router](./17-mini-router/) | ~368 | 路径匹配、通配符、守卫 | 30 |
| 18 | [mini-react](./18-mini-react/) | ~380 | createElement、render、hooks | 25 |
| 19 | [mini-vdom](./19-mini-vdom/) | ~331 | diff 算法、patch、keyed children | 26 |
| 20 | [mini-fiber](./20-mini-fiber/) | ~358 | work loop、时间切片、lanes | 27 |
| 21 | [mini-observable](./21-mini-observable/) | ~348 | 热/冷 Observable、操作符、背压 | 24 |
| 22 | [mini-state](./22-mini-state/) | ~182 | atom/selector、派生状态 | 14 |

### 设计模式 & 工具 (TypeScript)

| # | 项目 | 代码行 | 核心概念 | 测试数 |
|:--|:-----|:-------|:---------|:-------|
| 23 | [mini-di](./23-mini-di/) | ~188 | IoC 容器、装饰器、作用域 | 7 |
| 25 | [mini-proxy](./25-mini-proxy/) | ~205 | ES Proxy、响应式、拦截器 | 15 |
| 26 | [mini-compiler](./26-mini-compiler/) | ~339 | 词法分析、语法分析、代码生成 | 28 |
| 28 | [mini-orm](./28-mini-orm/) | ~261 | 装饰器、查询构建器、关联 | 12 |
| 29 | [mini-validator](./29-mini-validator/) | ~219 | schema DSL、类型推断、自定义规则 | 18 |

---

## 🎯 设计理念

- **一个文件夹，一个概念** — 专注的实现
- **行内注释** — 解释每个非显而易见的决定
- **包含测试** — 每个项目都有可运行的测试
- **双语文档** — English + 中文

---

## 🚀 快速开始

```bash
# 克隆
git clone https://github.com/bkmashiro/build-your-own-x-mini.git
cd build-your-own-x-mini

# 运行 TypeScript 项目
cd 15-mini-promise
pnpm install
pnpm test

# 运行 Python 项目
cd 01-mini-redis
python -m pytest
```

---

## 🗺️ 路线图

### 已完成 ✅
- [x] 01-11：核心系统 (Python)
- [x] 12-22：前端 & JS 运行时 (TypeScript)
- [x] 23-29：设计模式 & 工具 (TypeScript)

### 计划中
- [ ] 24-mini-signals — 细粒度响应式
- [ ] 27-mini-ioc — 控制反转
- [ ] 30-mini-graphql — schema、resolvers、执行
- [ ] 31-mini-wasm — 二进制格式、栈机
- [ ] 32-mini-lisp — S 表达式、eval/apply

---

## 📊 统计

| 指标 | 数值 |
|------|------|
| 总项目数 | 27 |
| 总代码行数 | ~7,500 |
| 总测试数 | ~400 |
| 语言 | Python, TypeScript |

---

## 📄 许可证

MIT © [bkmashiro](https://github.com/bkmashiro)
