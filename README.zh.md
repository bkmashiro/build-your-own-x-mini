<div align="center">

# 🔧 build-your-own-x-mini

**用不到 200 行代码实现真实系统的核心 — 简洁可读。**

[![GitHub stars](https://img.shields.io/github/stars/bkmashiro/build-your-own-x-mini?style=for-the-badge&logo=github&color=FFD700)](https://github.com/bkmashiro/build-your-own-x-mini)
[![MIT License](https://img.shields.io/badge/许可证-MIT-22c55e?style=for-the-badge)](LICENSE)

[English](README.md) | **中文**

> 不是生产代码，但足以理解它*是怎么工作的*。
> 每周三自动新增一个项目。已收录 **30 个项目**，持续更新中。

</div>

---

## 📦 项目列表

### 系统与基础设施 (Python)

| # | 项目 | 代码行数 | 难度 | 核心概念 |
|:--|:-----|:---------|:-----|:---------|
| 01 | [mini-redis（中文）](./01-mini-redis/README.zh.md) ([English](./01-mini-redis/README.md)) | ~180 | ⭐⭐ | RESP2 协议、asyncio、TTL |
| 02 | [mini-git（中文）](./02-mini-git/README.zh.md) ([English](./02-mini-git/README.md)) | ~190 | ⭐⭐ | SHA1 哈希、zlib、内容寻址存储 |
| 03 | [mini-http（中文）](./03-mini-http/README.zh.md) ([English](./03-mini-http/README.md)) | ~190 | ⭐⭐ | HTTP/1.1 解析、socket API、路由、线程 |
| 04 | [mini-lsm（中文）](./04-mini-lsm/README.zh.md) ([English](./04-mini-lsm/README.md)) | ~180 | ⭐⭐⭐ | MemTable、SSTable、点查询、Compaction |
| 05 | [mini-raft（中文）](./05-mini-raft/README.zh.md) ([English](./05-mini-raft/README.md)) | ~290 | ⭐⭐⭐ | 选主、term、日志复制、多数提交 |
| 06 | [mini-regex（中文）](./06-mini-regex/README.zh.md) ([English](./06-mini-regex/README.md)) | ~168 | ⭐⭐⭐ | NFA 构建、Thompson 算法、epsilon-closure、回溯 |
| 07 | [mini-vm（中文）](./07-mini-vm/README.zh.md) ([English](./07-mini-vm/README.md)) | ~160 | ⭐⭐ | 栈式字节码、编译器、调用帧、反汇编 |
| 08 | [mini-malloc（中文）](./08-mini-malloc/README.zh.md) ([English](./08-mini-malloc/README.md)) | ~110 | ⭐⭐ | 空闲链表、first-fit、realloc、合并 |
| 09 | [mini-tls（中文）](./09-mini-tls/README.zh.md) ([English](./09-mini-tls/README.md)) | ~165 | ⭐⭐⭐ | TLS 1.3 握手、key schedule、AES-GCM、证书结构 |
| 10 | [mini-db（中文）](./10-mini-db/README.zh.md) ([English](./10-mini-db/README.md)) | ~172 | ⭐⭐ | SQL 解析、WHERE 执行、有序索引、内存表 |
| 11 | [mini-shell（中文）](./11-mini-shell/README.zh.md) ([English](./11-mini-shell/README.md)) | ~190 | ⭐⭐ | 词法分析、fork/exec、管道、重定向、内置命令 |
| 30 | [mini-neural-net（中文）](./30-mini-neural-net/README.zh.md) ([English](./30-mini-neural-net/README.md)) | ~195 | ⭐⭐ | 前向传播、反向传播、链式法则、SGD、XOR 演示 |

### 前端与语言运行时 (TypeScript)

| # | 项目 | 代码行数 | 难度 | 核心概念 |
|:--|:-----|:---------|:-----|:---------|
| 12 | [mini-json-parser](./12-mini-json-parser/README.md) | ~493 | ⭐⭐ | 词法分析、递归下降解析、Unicode 转义、错误定位 |
| 13 | [mini-lru-cache](./13-mini-lru-cache/README.md) | ~162 | ⭐ | HashMap + 双向链表、O(1) get/put、哨兵节点、淘汰策略 |
| 14 | [mini-event-loop](./14-mini-event-loop/README.md) | ~369 | ⭐⭐ | 宏任务/微任务队列、虚拟时钟、执行追踪 |
| 15 | [mini-promise](./15-mini-promise/README.md) | ~296 | ⭐⭐⭐ | Promise/A+ 规范、状态机、链式调用、`.all/.race/.any` |
| 16 | [mini-bundler](./16-mini-bundler/README.md) | ~580 | ⭐⭐⭐ | ES 模块解析、依赖图、循环检测、IIFE 输出 |
| 17 | [mini-router](./17-mini-router/README.md) | ~368 | ⭐⭐ | Hash/history 模式、路由参数、嵌套路由、守卫 |
| 18 | [mini-react](./18-mini-react/README.md) | ~380 | ⭐⭐⭐ | VNode 树、`useState`、`useEffect`、diff 算法、DOM 补丁 |
| 19 | [mini-vdom](./19-mini-vdom/README.md) | ~331 | ⭐⭐⭐ | Hyperscript 工厂、mount/patch、带 key 协调、LIS 优化 |
| 20 | [mini-fiber](./20-mini-fiber/README.md) | ~358 | ⭐⭐⭐ | Fiber 节点、优先级队列、时间切片、可中断渲染 |
| 21 | [mini-observable](./21-mini-observable/README.md) | ~348 | ⭐⭐ | Observable、pipe 组合、操作符（map/filter/take/debounce）、Subject |
| 22 | [mini-state](./22-mini-state/README.md) | ~182 | ⭐⭐ | Redux 风格 `createStore`、中间件、`combineReducers` |
| 23 | [mini-di](./23-mini-di/README.md) ([中文](./23-mini-di/README.zh.md)) | ~188 | ⭐⭐ | `@Injectable` 装饰器、类型化 token、单例/瞬态作用域 |
| 24 | [mini-scheduler](./24-mini-scheduler/README.md) | ~338 | ⭐⭐ | 优先级队列、延迟执行、取消、协作式调度 |
| 25 | [mini-proxy](./25-mini-proxy/README.md) | ~205 | ⭐⭐ | 基于 Proxy 的响应式、`reactive()`、`ref()`、`computed()`、`effect()` |
| 26 | [mini-compiler](./26-mini-compiler/README.md) | ~339 | ⭐⭐⭐ | Lisp → C 风格变换、词法分析、AST、代码生成 |
| 27 | [mini-pubsub](./27-mini-pubsub/README.md) | ~383 | ⭐⭐ | 基于主题的消息、通配符订阅、消息历史 |
| 28 | [mini-orm](./28-mini-orm/README.md) | ~261 | ⭐⭐ | `@Entity/@Column` 装饰器、CRUD、内存存储 |
| 29 | [mini-validator](./29-mini-validator/README.md) | ~219 | ⭐⭐ | 基于装饰器的验证、嵌套对象、自定义验证器 |

### 孵化项目

| # | 项目 | 代码行 | 核心概念 | 测试数 |
|:--|:-----|:-------|:---------|:-------|
| 12 | [mini-neural-net](./projects/12-mini-neural-net/README.md) ([中文](./projects/12-mini-neural-net/README.zh.md)) | ~80 | 前向传播、反向传播、SGD、XOR 演示 | — |
| 13 | [mini-docker](./projects/13-mini-docker/README.md) ([中文](./projects/13-mini-docker/README.zh.md)) | ~110 | namespaces、cgroup v2、overlayfs、chroot | — |
| 14 | [mini-physics](./projects/14-mini-physics/) | ~155 | 刚体、AABB 碰撞、冲量解算、2D 模拟 | 4 |
| 15 | [mini-lisp](./projects/15-mini-lisp/) | ~148 | tokenizer、reader、求值器、闭包、尾调用优化 | 4 |
| 16 | [mini-browser](./projects/16-mini-browser/) | ~160 | HTML tokenizer、CSS 盒模型、块级布局、终端渲染 | demo |
| 17 | [mini-bitcoin](./projects/17-mini-bitcoin/) | ~90 | SHA256、Merkle tree、工作量证明、链校验 | demo |
| 18 | [mini-torrent](./projects/18-mini-torrent/) | ~130 | DHT、Peer Wire Protocol、piece 选择、seeding | demo |
| 19 | [mini-ray-tracer](./projects/19-mini-ray-tracer/) | ~135 | ray-sphere intersection、BVH、阴影、反射 | demo |
| 20 | [mini-search](./projects/20-mini-search/) | ~80 | 倒排索引、TF-IDF、BM25、查询排序 | demo |
| 21 | [mini-os](./projects/21-mini-os/) | ~156 | bootloader 流程、中断、内存分页、round-robin 调度器 | demo |
| 22 | [mini-riscv](./projects/22-mini-riscv/) | ~184 | RV32I 解码、整数 ALU、IF/ID/EX/MEM/WB 流水线、分支 flush | demo |
| 24 | [mini-signals](./projects/24-mini-signals/) | ~210 | signals、effects、memos、批量更新 | 6 |
| 25 | [mini-compiler](./projects/25-mini-compiler/) | ~191 | 词法分析、递归下降解析、AST、栈式代码生成 | demo |
| 27 | [mini-blockchain](./projects/27-mini-blockchain/) | ~145 | 区块、SHA256、工作量证明、账户余额、链校验 | demo |
| 27 | [mini-ioc](./projects/27-mini-ioc/) | ~205 | 类型化 token、作用域、资源释放 | 6 |

**难度说明**: ⭐ 入门 — ⭐⭐ 中级 — ⭐⭐⭐ 进阶

---

## 🎯 理念

- 一个文件，一个概念
- 每个不显而易见的决策都有内联注释说明
- 包含可运行的演示
- **中英双语解析** — 完整英文解析 + 完整中文解析（非摘要）

---

## 📄 许可证

MIT © [bkmashiro](https://github.com/bkmashiro)
