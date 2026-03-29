# mini-torrent

> 一个极简 BitTorrent 内核：Kademlia DHT 节点发现、Peer Wire Protocol 报文，以及 rarest-first 分片选择。

[English](README.md)

---

## 背景

真实的 BitTorrent 客户端至少要做三件事：

- 通过 DHT 找到节点和 peer
- 建立连接后说 Peer Wire Protocol
- 决定下一个该下载哪个 piece

这个项目把这些核心概念压缩进一个小文件里。它不是完整的 torrent 客户端，但足以看清发现流程、握手格式和 rarest-first 调度。

---

## 架构

```text
bootstrap 节点
  -> UDP DHT 查询（find_node / get_peers）
  -> 紧凑节点列表
  -> peer 握手
  -> peer wire 消息
  -> piece 可用度统计
  -> rarest-first 选择器
```

---

## 核心实现

### DHT 发现

`DHTNode` 向 bootstrap 节点发送 Kademlia 风格的 UDP 查询。实现里会构造 bencode 的 `find_node` 和 `get_peers` 消息，用事务 ID 匹配响应，并把紧凑的 26 字节节点记录解析为 `(node_id, ip, port)`。

### Peer Wire Protocol

`PeerWire.handshake()` 构造标准 BitTorrent 握手：

- `pstrlen`
- `pstr`
- `reserved`
- `info_hash`
- `peer_id`

同时也提供常见 peer wire 帧的打包和解析，例如 `interested`、`bitfield`、`request`。

### Piece 选择

`PiecePicker` 统计每个 piece 被多少个 peer 宣告拥有。`choose()` 只在尚未下载的 piece 中选择，并返回可用度最低的那个，这就是经典的 rarest-first 策略。

---

## 运行方式

```bash
python projects/18-mini-torrent/demo.py
```

demo 会启动一个本地假的 DHT bootstrap 节点，真实发送 UDP `find_node` 和 `get_peers` 请求，打印发现到的节点，模拟 BitTorrent 握手，并展示 rarest-first 的选择结果。

---

## 省略内容

- TCP peer 连接与真实 piece 下载
- 完整的 bencode 校验和异常处理
- 路由表、token、announce、持续 seeding 循环
- choke/unchoke 状态机和 endgame 模式

这些都属于更大的子系统。这里的目标是把发现流程和线协议格式讲清楚。
