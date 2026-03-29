# mini-bitcoin

> 一个用 Python 写的极简 Bitcoin 风格区块链：SHA256 哈希、Merkle root、工作量证明挖矿、整链校验。

[English](README.md)

---

## 背景

Bitcoin 区块的核心有三件事：

- 把交易哈希成一个 Merkle root
- 让每个区块指向前一个区块的哈希
- 通过工作量证明决定一个区块是否可接受

这个项目把这些机制压缩到一个很小的文件里。它不是一个真正的加密货币实现，只是为了把数据流和校验规则讲清楚。

---

## 架构

```text
transactions
  -> SHA256 叶子哈希
  -> Merkle tree
  -> block header
  -> nonce 搜索
  -> 前导零区块哈希
  -> 追加到链上
  -> 整链校验
```

---

## 核心实现

### SHA256

`sha256()` 是对 `hashlib.sha256()` 的轻量封装。交易叶子、Merkle 父节点和区块头哈希都走同一个原语。

### Merkle tree

`merkle_root()` 先对每笔交易做哈希，再反复把相邻节点两两组合哈希，直到只剩一个根节点。如果某一层节点数为奇数，就复制最后一个哈希，这和常见的 Bitcoin 风格做法一致。

### 工作量证明

每个区块包含：

- index
- previous block hash
- timestamp
- transactions
- nonce
- difficulty
- Merkle root

挖矿过程会不断递增 nonce，直到区块哈希以前 `difficulty` 个零开头。

### 链校验

`Blockchain.is_valid()` 会检查：

- 区块内容重新计算后是否等于存储的哈希
- Merkle root 是否和交易列表匹配
- 区块哈希是否满足 PoW 目标
- `prev_hash` 是否正确指向前一个区块
- 区块 index 是否连续

---

## 运行方式

```bash
python projects/17-mini-bitcoin/demo.py
```

演示会挖出两个新区块，打印每个区块的哈希和 Merkle root，然后验证整条链。

---

## 省略内容

- 节点网络和 peer discovery
- 真实交易格式和数字签名
- UTXO 记账
- 难度调整
- 分叉和最长链选择

这些都是更大的子系统。这里的目标只是把区块结构和校验流程讲清楚。
