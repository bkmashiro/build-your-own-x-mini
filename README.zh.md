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
| 01 | [mini-redis（中文）](./projects/mini-redis/README.zh.md) ([English](./projects/mini-redis/README.md)) | ~180 | RESP2 协议、asyncio、TTL | ✅ |
| 02 | [mini-git（中文）](./02-mini-git/README.zh.md) ([English](./02-mini-git/README.md)) | ~190 | SHA1 哈希、zlib、内容寻址存储 | ✅ |
| 03 | [mini-http（中文）](./03-mini-http/README.zh.md) ([English](./03-mini-http/README.md)) | ~190 | HTTP/1.1 解析、socket API、路由、线程 | ✅ |
| 04 | [mini-lsm（中文）](./04-mini-lsm/README.zh.md) ([English](./04-mini-lsm/README.md)) | ~180 | MemTable、SSTable、点查询、Compaction | ✅ |
| 05 | [mini-raft（中文）](./05-mini-raft/README.zh.md) ([English](./05-mini-raft/README.md)) | ~290 | 选主、term、日志复制、多数提交 | ✅ |
| 06 | [mini-regex（中文）](./06-mini-regex/README.zh.md) ([English](./06-mini-regex/README.md)) | ~168 | NFA 构建、Thompson 算法、epsilon-closure、回溯 | ✅ |
| 07 | [mini-vm（中文）](./07-mini-vm/README.zh.md) ([English](./07-mini-vm/README.md)) | ~160 | 栈式字节码、编译器、调用帧、反汇编 | ✅ |
| 08 | [mini-malloc（中文）](./08-mini-malloc/README.zh.md) ([English](./08-mini-malloc/README.md)) | ~110 | 空闲链表、first-fit、realloc、合并 | ✅ |
| 09 | [mini-tls（中文）](./09-mini-tls/README.zh.md) ([English](./09-mini-tls/README.md)) | ~165 | TLS 1.3 握手、key schedule、AES-GCM、证书结构 | ✅ |

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
- [ ] mini-db — SQL 解析、执行计划、存储

---

## 📄 许可证

MIT © [bkmashiro](https://github.com/bkmashiro)
