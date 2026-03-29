<div align="center">

# 🔧 build-your-own-x-mini

**用不到 200 行代码实现真实系统的核心 — 简洁可读。**

[![GitHub stars](https://img.shields.io/github/stars/bkmashiro/build-your-own-x-mini?style=for-the-badge&logo=github&color=FFD700)](https://github.com/bkmashiro/build-your-own-x-mini)
[![MIT License](https://img.shields.io/badge/许可证-MIT-22c55e?style=for-the-badge)](LICENSE)

[English](README.md) | **中文**

> 不是生产代码，但足以理解它*是怎么工作的*。  
> 每周三自动新增一个项目。

</div>

---

## 📦 项目列表

| # | 项目 | 代码行数 | 核心概念 | 解析 |
|:--|:-----|:---------|:---------|:-----|
| 01 | [mini-redis（中文）](./01-mini-redis/README.zh.md) ([English](./01-mini-redis/README.md)) | ~180 | RESP2 协议、asyncio、TTL | ✅ |
| 02 | [mini-git（中文）](./02-mini-git/README.zh.md) ([English](./02-mini-git/README.md)) | ~190 | SHA1 哈希、zlib、内容寻址存储 | ✅ |
| 03 | [mini-http（中文）](./03-mini-http/README.zh.md) ([English](./03-mini-http/README.md)) | ~190 | HTTP/1.1 解析、socket API、路由、线程 | ✅ |
| 04 | [mini-lsm（中文）](./04-mini-lsm/README.zh.md) ([English](./04-mini-lsm/README.md)) | ~180 | MemTable、SSTable、点查询、Compaction | ✅ |
| 05 | [mini-raft（中文）](./05-mini-raft/README.zh.md) ([English](./05-mini-raft/README.md)) | ~290 | 选主、term、日志复制、多数提交 | ✅ |
| 06 | [mini-regex（中文）](./06-mini-regex/README.zh.md) ([English](./06-mini-regex/README.md)) | ~168 | NFA 构建、Thompson 算法、epsilon-closure、回溯 | ✅ |
| 07 | [mini-vm（中文）](./07-mini-vm/README.zh.md) ([English](./07-mini-vm/README.md)) | ~160 | 栈式字节码、编译器、调用帧、反汇编 | ✅ |
| 08 | [mini-malloc（中文）](./08-mini-malloc/README.zh.md) ([English](./08-mini-malloc/README.md)) | ~110 | 空闲链表、first-fit、realloc、合并 | ✅ |
| 09 | [mini-tls（中文）](./09-mini-tls/README.zh.md) ([English](./09-mini-tls/README.md)) | ~165 | TLS 1.3 握手、key schedule、AES-GCM、证书结构 | ✅ |
| 10 | [mini-db（中文）](./10-mini-db/README.zh.md) ([English](./10-mini-db/README.md)) | ~172 | SQL 解析、WHERE 执行、有序索引、内存表 | ✅ |
| 11 | [mini-shell（中文）](./11-mini-shell/README.zh.md) ([English](./11-mini-shell/README.md)) | ~190 | 词法分析、fork/exec、管道、重定向、内置命令 | ✅ |
| 12 | [mini-neural-net（中文）](./projects/12-mini-neural-net/README.zh.md) ([English](./projects/12-mini-neural-net/README.md)) | ~80 | 前向传播、反向传播、SGD、XOR 演示 | ✅ |
| 13 | [mini-docker（中文）](./projects/13-mini-docker/README.zh.md) ([English](./projects/13-mini-docker/README.md)) | ~110 | namespaces、cgroup v2、overlayfs、chroot | ✅ |

### 孵化项目

| # | 项目 | 代码行 | 核心概念 | 测试数 |
|:--|:-----|:-------|:---------|:-------|
| 15 | [mini-lisp](./projects/15-mini-lisp/) | ~148 | tokenizer、reader、求值器、闭包、尾调用优化 | 4 |
| 16 | [mini-browser](./projects/16-mini-browser/) | ~160 | HTML tokenizer、CSS 盒模型、块级布局、终端渲染 | demo |
| 17 | [mini-bitcoin](./projects/17-mini-bitcoin/) | ~90 | SHA256、Merkle tree、工作量证明、链校验 | demo |
| 14 | [mini-physics](./projects/14-mini-physics/) | ~155 | 刚体、AABB 碰撞、冲量解算、2D 模拟 | 4 |
| 24 | [mini-signals](./projects/24-mini-signals/) | ~210 | signals、effects、memos、批量更新 | 6 |
| 27 | [mini-ioc](./projects/27-mini-ioc/) | ~205 | 类型化 token、作用域、资源释放 | 6 |

---

## 🎯 理念

- 一个文件，一个概念
- 每个不显而易见的决策都有内联注释说明
- 包含可运行的演示
- **中英双语解析** — 完整英文解析 + 完整中文解析（非摘要）

---

## 🗺️ 路线图

- [x] mini-lsm — LSM 树、内存表、SSTables
- [x] mini-raft — 领导者选举、日志复制
- [x] mini-regex — NFA 构建、回溯
- [x] mini-vm — 字节码解释器、栈式虚拟机
- [x] mini-malloc — 空闲链表、first-fit 分配器
- [x] mini-tls — Record Layer、握手、证书
- [x] mini-db — SQL 解析、执行计划、存储
- [x] projects/12-mini-neural-net — 前向传播、反向传播、SGD、XOR 演示
- [ ] 12-mini-json-parser — 递归下降解析器、AST、IEEE-754
- [ ] 13-mini-lru-cache — HashMap + 双向链表、O(1) get/put
- [ ] 14-mini-event-loop — 单线程异步、epoll/kqueue、微任务队列
- [ ] 15-mini-actor — Actor 模型、消息传递、监督树
- [ ] 16-mini-rpc — 二进制协议、序列化、连接池
- [ ] 17-mini-bloom-filter — 概率集合、误判率、位数组
- [ ] 18-mini-b-tree — 平衡树、节点分裂/合并、范围查询
- [ ] 19-mini-wal — 预写日志、崩溃恢复、日志回放
- [ ] 20-mini-pubsub — 发布-订阅、主题路由、背压控制

---

## 📄 许可证

MIT © [bkmashiro](https://github.com/bkmashiro)
