# 05 — mini-raft

> A minimal Raft consensus simulation in pure Python — ~290 lines.

## What we build

A tiny in-memory Raft cluster with:

- follower / candidate / leader roles
- randomized election timeouts on a logical clock
- `RequestVote` for leader election
- `AppendEntries` for heartbeats and log replication
- leader commit and apply to a tiny state machine

This is not a production networked implementation. It is a runnable model of the core Raft control flow.

## How Raft works

### Leader election

1. Followers wait for heartbeats from a leader.
2. If a follower times out, it becomes a **candidate**, increments its term, and asks peers for votes.
3. If it gets a majority, it becomes the **leader**.

### Log replication

The leader accepts a command, appends it to its own log, and sends `AppendEntries` RPCs to followers.

Followers only keep entries that match the leader's previous log index and term. If logs diverge, conflicting suffixes are truncated and repaired from the leader.

### Commit rule

An entry is committed once the leader knows it is stored on a majority of nodes. After commit, each node applies the command to its tiny state machine.

## Usage

```bash
python3 demo.py
```

### As a library

```python
from mini_raft import RaftCluster

cluster = RaftCluster(["n1", "n2", "n3"])
cluster.tick(10)
leader = cluster.leader()
leader.propose(cluster, "set x 1")

for node in cluster.nodes.values():
    print(node.node_id, node.state_machine)
```

## What we skip

- Real networking, RPC retries, and persistence
- Crash recovery and snapshots
- Membership changes
- Linearizable reads
- Client redirects and retry handling
- Durable WAL / fsync semantics

---

## 中文摘要

mini-raft 用一个可运行的内存模拟，把 Raft 的核心流程压缩到很小的 Python 实现里。

**核心概念：**
- **选主**：Follower 超时后发起投票，拿到多数票成为 Leader
- **日志复制**：Leader 通过 `AppendEntries` 把命令同步给 Follower
- **日志修复**：如果 Follower 日志和 Leader 冲突，就截断冲突后缀再重放
- **提交**：日志被多数节点保存后才算 committed，随后应用到状态机

**和真实 Raft 系统的差距：** 没有真实网络、没有持久化、没有快照、没有成员变更。但 term、投票、多数派提交、心跳复制、日志回退这些关键机制都在。
