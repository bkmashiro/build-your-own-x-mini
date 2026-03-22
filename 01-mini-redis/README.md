# mini-redis

> A minimal Redis implementation in Python — 180 lines, asyncio, RESP2 protocol.

## What it implements

- **RESP2 protocol** — the same wire format as Redis
- **Commands**: PING, ECHO, SET, GET, DEL, EXPIRE, TTL, KEYS, FLUSHDB, DBSIZE
- **TTL/Expiry** — lazy expiration on access
- **asyncio** — non-blocking TCP server

## Not implemented (by design)

- Persistence (RDB/AOF)
- Pub/Sub, Streams, Sorted Sets
- Clustering or replication

## Quick Start

```bash
python projects/mini-redis/src/mini_redis.py
# then in another terminal:
redis-cli -p 6399
```

Or run the demo:
```bash
# terminal 1
python projects/mini-redis/src/mini_redis.py
# terminal 2
python projects/mini-redis/demo.py
```

## How It Works

### RESP2 Protocol

Redis uses a simple text protocol called RESP (REdis Serialization Protocol):

- Simple String: `+OK\r\n`
- Error: `-ERR message\r\n`
- Integer: `:42\r\n`
- Bulk String: `$5\r\nhello\r\n` (length-prefixed)
- Array: `*3\r\n$3\r\nSET\r\n$3\r\nfoo\r\n$3\r\nbar\r\n`

Our parser reads one byte at a time to identify the type, then handles accordingly.

### Lazy Expiration

When a key is set with EXPIRE, we store `(value, expire_at_timestamp)`. On every GET/TTL access, we check if `time.time() > expire_at` and delete it if so. Simple, no background thread needed.

### asyncio

Each client connection gets a coroutine (`handle_client`). The server uses `asyncio.start_server` — no threading needed.

---

## 中文摘要

mini-redis 是用 Python asyncio 实现的最小 Redis 服务器，约 180 行代码。

**核心概念：**
- **RESP2 协议**：Redis 使用简单的文本协议，按首字节（`+/-/:/$/*`）区分消息类型
- **懒惰过期**：不用后台线程，访问时检查 TTL，过期则删除
- **asyncio**：用协程处理并发连接，比线程更轻量

**和真实 Redis 的差距：** 没有持久化（RDB/AOF），没有发布订阅，没有集群。但 SET/GET/EXPIRE/TTL 的核心逻辑完全一致。
