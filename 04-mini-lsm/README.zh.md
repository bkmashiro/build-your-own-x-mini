# 04 — mini-lsm

> 一个用纯 Python 实现的最小 LSM 树 —— 约 180 行。

## 我们要构建什么

一个两层的极简 LSM-tree：带有序 MemTable、不可变 SSTable 文件、点查询，以及 `L0 -> L1` 压缩（compaction）。

## LSM-tree 是怎么工作的

### 写路径

1. 新写入先进入内存中的 **MemTable**。
2. 当 MemTable 达到大小阈值时，将其刷盘成 `L0` 中的一个有序、不可变 **SSTable** 文件。
3. 随着继续写入，会产生更多 `L0` 文件。

### 读路径

点查询会先看更新的数据：

```
MemTable -> 最新的 L0 SSTable -> 更老的 L0 SSTable -> L1 SSTable
```

正是这个“从新到旧”的查找顺序，让覆盖写无需修改旧文件也能成立。

### Compaction（压缩）

压缩会把多个 `L0` 文件合并成一个 `L1` 文件：

- 先读取更老的数据
- 让更新的数据覆盖旧值
- 写出一个新的有序文件
- 删除旧文件

这就是 LSM 的核心思想：**先把写入做快，再异步归并整理**。

## 用法

```bash
python3 demo.py
```

### 作为库使用

```python
from mini_lsm import MiniLSM

db = MiniLSM("data", memtable_limit=3)
db.put("apple", "1")
db.put("banana", "2")
db.put("apple", "3")

db.flush()
print(db.get("apple"))  # 3

db.compact()
```

## 这里省略了什么

- 删除标记（tombstone）
- Bloom Filter
- 二分查找索引 / 稀疏索引
- 范围扫描和迭代器
- WAL 预写日志
- 超过 `L0 -> L1` 的多层压缩策略
- 崩溃恢复 / 校验和 / manifest

---

## 中文摘要

mini-lsm 用不到 200 行 Python 实现了一个最小可运行的 LSM 树。

**核心概念：**
- **MemTable**：写入先进入内存中的有序映射
- **SSTable**：刷盘后得到的不可变、有序文件
- **读路径**：始终先查新数据，再查老数据
- **Compaction**：把多个 `L0` 文件合并成一个 `L1` 文件，降低读取时需要扫描的文件数量

**和真实 LSM 数据库的差距：** 没有 WAL、没有删除标记、没有 Bloom Filter、没有更复杂的多层 compaction 策略。但写入、刷盘、点查询、层间合并这些关键机制都已经完整体现出来了。
