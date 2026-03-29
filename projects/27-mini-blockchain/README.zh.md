# mini-blockchain

> 一个用 Python 写的极简区块链：区块结构、SHA256 哈希、工作量证明挖矿、简单账户交易、整链校验。

[English](README.md)

---

## 背景

区块链要成立，至少要有几条核心规则：

- 每个区块都要哈希自己的内容
- 每个区块都要指向前一个区块的哈希
- 挖矿需要工作量证明
- 交易不能花掉不存在的余额

这个项目把这些规则压缩在一个文件里。为了让校验逻辑保持可读，它采用简单账户模型，而不是 Bitcoin 的 UTXO 模型。

---

## 架构

```text
待打包交易
  -> 区块 payload
  -> SHA256 哈希
  -> 搜索满足前导零的 nonce
  -> 追加到链上
  -> 重放交易并验证余额
```

---

## 核心实现

### `Block`

每个区块保存：

- `index`
- `prev_hash`
- `transactions`
- `timestamp`
- `nonce`
- `difficulty`
- `hash`

`compute_hash()` 用 `json.dumps(..., sort_keys=True)` 做确定性序列化，再交给 SHA256 计算哈希。

### 工作量证明

`Block.mine()` 会不断递增 `nonce`，直到区块哈希以前 `difficulty` 个零开头。

### 简单交易

交易用普通字典表示：

```python
{"sender": "alice", "recipient": "bob", "amount": 15}
```

`Blockchain.add_transaction()` 会拒绝非法数据，把 `SYSTEM` 保留给挖矿奖励，并在加入待打包队列前检查发送方的可花费余额（包含未打包交易）。

### 链校验

`Blockchain.is_valid()` 会重放整条链，并检查：

- 存储哈希是否等于重新计算结果
- 非创世区块是否正确指向前一个哈希
- 是否满足工作量证明目标
- 交易结构是否合法
- 任意账户余额是否跌到负数
- 每个已挖出的区块是否恰好有一笔奖励交易

---

## 运行方式

```bash
python projects/27-mini-blockchain/demo.py
```

演示会挖出两个新区块，打印区块哈希和余额，然后故意篡改一笔交易，展示链校验失败。

---

## 省略内容

- 节点网络和 peer discovery
- 数字签名
- UTXO 集和脚本系统
- 动态难度调整
- 分叉与多节点共识

这里的目标是把区块生命周期讲清楚：创建交易、挖矿、哈希链接，以及通过重放状态来验证整条链。
