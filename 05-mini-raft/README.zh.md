# 05 — mini-raft

> 一个用纯 Python 实现的最小 Raft 共识模拟 —— 约 290 行。

## 我们要构建什么

一个内存中的极简 Raft 集群，包含：

- follower / candidate / leader 三种角色
- 基于逻辑时钟的随机选举超时
- 用 `RequestVote` 完成领导者选举
- 用 `AppendEntries` 完成心跳和日志复制
- Leader 提交日志并应用到一个很小的状态机

这不是生产级网络实现，而是一个可以直接运行、用来理解 Raft 主流程的模型。

## Raft 是怎么工作的

### 领导者选举

1. Follower 等待来自 Leader 的心跳。
2. 如果超时没有收到心跳，它会变成 **Candidate**，增加 term，并向其他节点请求投票。
3. 一旦获得多数票，它就成为 **Leader**。

### 日志复制

Leader 接收命令后，先把它追加到自己的日志，再通过 `AppendEntries` RPC 发给 Follower。

Follower 只会接受“前一个日志位置和 term 都匹配”的新日志。如果发生分歧，就截断冲突后缀，再从 Leader 的日志重新同步。

### 提交规则

当 Leader 确认一条日志已经写入多数节点时，这条日志才算 committed。提交之后，各节点把它应用到自己的状态机。

## 用法

```bash
python3 demo.py
```

### 作为库使用

```python
from mini_raft import RaftCluster

cluster = RaftCluster(["n1", "n2", "n3"])
cluster.tick(10)
leader = cluster.leader()
leader.propose(cluster, "set x 1")

for node in cluster.nodes.values():
    print(node.node_id, node.state_machine)
```

## 这里省略了什么

- 真实网络、RPC 重试和持久化
- 崩溃恢复和快照
- 成员变更
- 线性一致读
- 客户端重定向和重试逻辑
- 真正的 WAL / fsync 语义

---

## 中文摘要

mini-raft 用很小的 Python 代码实现了一个可运行的 Raft 核心模型。

**核心概念：**
- **选主**：Follower 超时后发起投票，拿到多数票成为 Leader
- **复制**：Leader 把命令写入自己的日志，再同步到多数 Follower
- **修复**：Follower 日志冲突时，先回退再追上 Leader
- **提交**：只有多数节点确认的日志才会应用到状态机

**和真实 Raft 系统的差距：** 没有真实网络、没有落盘、没有快照、没有集群成员变更。但 term、投票、日志复制、冲突回退、多数派提交这些核心机制已经完整展示出来了。
