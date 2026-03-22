# 01 — mini-redis 最小 Redis 实现

[English](README.md)

> 用 Python asyncio 实现的最小 Redis 服务器，~180 行代码，完全兼容 redis-cli 的 RESP2 协议。

---

## 背景与动机

Redis 是现代后端开发中最常用的内存数据库，几乎所有 Web 服务都依赖它做缓存、限流、会话存储。但"Redis 到底是怎么工作的？"往往停留在概念层面。

这个项目的目标是：**剥掉所有企业级功能，只留下核心逻辑**，用尽量少的代码实现一个可以被 `redis-cli` 直接连接使用的 Redis 服务器。

核心挑战有两个：
1. **RESP2 协议**：Redis 客户端和服务端如何在 TCP 上通信
2. **TTL 懒惰过期**：如何在不启动后台线程的情况下处理键过期

---

## 核心架构

整个服务器分为四个层次，从底到上依次是：

```
┌─────────────────────────────────────┐
│         asyncio TCP Server          │  ← 网络层：接收连接，读写字节
├─────────────────────────────────────┤
│          RESP2 Parser/Encoder        │  ← 协议层：字节 ↔ Python 对象
├─────────────────────────────────────┤
│         Command Dispatcher           │  ← 命令层：路由到具体处理逻辑
├─────────────────────────────────────┤
│           In-Memory Store            │  ← 存储层：字典 + TTL 映射
└─────────────────────────────────────┘
```

数据流：
```
redis-cli → TCP 字节流 → RESPParser → 命令列表 → dispatch() → Store → encode() → TCP 字节流 → redis-cli
```

### 选择 asyncio 而不是多线程

Redis 是单线程的（官方实现用事件循环 + IO 多路复用）。这里用 `asyncio` 模拟同样的模型：一个事件循环处理所有客户端连接，没有锁，没有竞态条件，代码比多线程简洁得多。

```python
async def main(host: str = "127.0.0.1", port: int = 6399):
    server = await asyncio.start_server(handle_client, host, port)
    async with server:
        await server.serve_forever()
```

---

## 关键实现

### RESP2 协议解析

RESP2 是 Redis 的序列化协议，所有通信都走这套格式。首字节决定消息类型：

| 首字节 | 类型         | 示例                              |
|--------|--------------|-----------------------------------|
| `+`    | 简单字符串   | `+OK\r\n`                         |
| `-`    | 错误         | `-ERR wrong number of args\r\n`   |
| `:`    | 整数         | `:42\r\n`                         |
| `$`    | 二进制字符串 | `$5\r\nhello\r\n`（长度前缀）     |
| `*`    | 数组         | `*2\r\n$3\r\nGET\r\n$3\r\nfoo\r\n` |

redis-cli 发过来的每条命令都是一个数组，比如 `SET foo bar` 在 TCP 上长这样：

```
*3\r\n$3\r\nSET\r\n$3\r\nfoo\r\n$3\r\nbar\r\n
```

解析器是增量式的 —— 数据可能分多个 TCP 包到达，`RESPParser` 维护一个内部缓冲区，每次 `feed()` 新数据后尝试从缓冲区提取完整命令：

```python
class RESPParser:
    def __init__(self):
        self.buf = b""

    def feed(self, data: bytes):
        self.buf += data

    def parse_one(self) -> tuple[Any, int] | None:
        if not self.buf:
            return None
        prefix = chr(self.buf[0])

        if prefix == '+':   # Simple string
            end = self.buf.find(b"\r\n")
            if end == -1: return None
            return self.buf[1:end].decode(), end + 2

        elif prefix == '$':  # Bulk string
            end = self.buf.find(b"\r\n")
            if end == -1: return None
            length = int(self.buf[1:end])
            if length == -1:
                return None, end + 2  # nil
            start = end + 2
            if len(self.buf) < start + length + 2:
                return None  # 数据不完整，等待更多字节
            return self.buf[start:start + length].decode(), start + length + 2

        elif prefix == '*':  # Array（大多数命令走这里）
            end = self.buf.find(b"\r\n")
            if end == -1: return None
            count = int(self.buf[1:end])
            items = []
            pos = end + 2
            saved_buf = self.buf
            self.buf = self.buf[pos:]
            for _ in range(count):
                result = self.parse_one()
                if result is None:
                    self.buf = saved_buf
                    return None  # 整个数组不完整，回滚
                val, consumed = result
                items.append(val)
                self.buf = self.buf[consumed:]
            consumed_total = len(saved_buf) - len(self.buf)
            self.buf = saved_buf
            return items, consumed_total
```

注意数组解析时的回滚逻辑：如果数组元素不完整，需要恢复 `self.buf`，等下次 `feed()` 更多数据再试。

编码方向（Python 对象 → RESP2 字节）要简单得多，直接按类型拼接：

```python
def encode(value: Any) -> bytes:
    if value is None:
        return b"$-1\r\n"                        # nil
    elif isinstance(value, int):
        return f":{value}\r\n".encode()
    elif isinstance(value, str):
        data = value.encode()
        return f"${len(data)}\r\n".encode() + data + b"\r\n"
    elif isinstance(value, list):
        parts = [f"*{len(value)}\r\n".encode()]
        for item in value:
            parts.append(encode(item))
        return b"".join(parts)
    elif isinstance(value, Exception):
        return f"-ERR {value}\r\n".encode()
```

### 懒惰过期（Lazy Expiration）

真实 Redis 结合了两种过期策略：
- **懒惰过期**：访问时检查，过期则删除
- **主动过期**：后台定期扫描，清理过期键

mini-redis 只实现懒惰过期，完全够用于演示目的：

```python
class Store:
    def __init__(self):
        self._data: dict[str, str] = {}
        self._expires: dict[str, float] = {}  # key → unix timestamp

    def _is_expired(self, key: str) -> bool:
        if key in self._expires:
            if time.time() > self._expires[key]:
                del self._data[key]
                del self._expires[key]
                return True
        return False

    def get(self, key: str) -> str | None:
        if self._is_expired(key): return None
        return self._data.get(key)

    def set(self, key: str, value: str, ex: int | None = None, px: int | None = None):
        self._data[key] = value
        self._expires.pop(key, None)  # 清除已有 TTL
        if ex is not None:
            self._expires[key] = time.time() + ex
        elif px is not None:
            self._expires[key] = time.time() + px / 1000

    def ttl(self, key: str) -> int:
        if key not in self._data or self._is_expired(key):
            return -2  # 键不存在
        if key not in self._expires:
            return -1  # 没有设置过期
        remaining = int(self._expires[key] - time.time())
        return max(0, remaining)
```

两个字典分开存储的设计（`_data` 和 `_expires`）让逻辑非常清晰：`set()` 时按需写入 `_expires`，`get()` 时先检查是否过期，过期则"顺手"删掉。

### 命令分发

命令处理层是一个简单的 if-elif 链，每个分支处理一个命令：

```python
def dispatch(args: list[str]) -> bytes:
    cmd = args[0].upper()

    if cmd == "SET":
        if len(args) < 3:
            return encode_error("wrong number of args for SET")
        key, value = args[1], args[2]
        ex = px = None
        i = 3
        while i < len(args):
            opt = args[i].upper()
            if opt == "EX" and i + 1 < len(args):
                ex = int(args[i + 1]); i += 2
            elif opt == "PX" and i + 1 < len(args):
                px = int(args[i + 1]); i += 2
            else:
                i += 1
        store.set(key, value, ex=ex, px=px)
        return encode_ok()

    elif cmd == "GET":
        return encode(store.get(args[1]))

    elif cmd == "KEYS":
        pattern = args[1] if len(args) > 1 else "*"
        return encode(store.keys(pattern))
    # ...
```

`SET` 命令支持 `EX`（秒）和 `PX`（毫秒）选项，解析方式是简单的线性扫描。

### asyncio 客户端处理

每个客户端连接对应一个协程，在同一个事件循环里并发运行：

```python
async def handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    parser = RESPParser()
    try:
        while True:
            data = await reader.read(4096)
            if not data:
                break
            parser.feed(data)
            while True:
                cmd = parser.get_command()
                if cmd is None:
                    break
                response = dispatch(cmd)
                writer.write(response)
                await writer.drain()
    except (ConnectionResetError, BrokenPipeError):
        pass
    finally:
        writer.close()
```

内循环（`while True: cmd = parser.get_command()`）的意义：一次 `read(4096)` 可能包含多条命令（pipeline 场景），需要循环提取直到缓冲区中没有完整命令为止。

---

## 如何运行

```bash
# 启动服务器（默认端口 6399，避免和本机 Redis 冲突）
python projects/mini-redis/src/mini_redis.py

# 另一个终端，用真实 redis-cli 连接
redis-cli -p 6399

# 基本操作
redis-cli -p 6399 set foo bar
redis-cli -p 6399 get foo
redis-cli -p 6399 set tmp 42 ex 5
redis-cli -p 6399 ttl tmp
redis-cli -p 6399 keys "*"

# 运行 demo 脚本
python projects/mini-redis/demo.py
```

---

## 关键收获

**1. 协议设计决定了实现复杂度**

RESP2 之所以简单，是因为它的设计非常务实：首字节标记类型，整数表示长度，`\r\n` 做分隔符。整个协议解析器 ~60 行就能写完。对比 HTTP/1.1 那种基于文本 header 的格式，RESP2 的解析效率高得多。

**2. 懒惰过期 vs 主动过期的权衡**

懒惰过期的缺点：过期的键只有在被访问时才会被清除，如果一个键设置了 TTL 但之后再也没有人访问它，它会一直占用内存。真实 Redis 通过每 100ms 随机抽样 20 个有 TTL 的键来做主动清理，在内存使用和 CPU 开销之间取得平衡。

**3. asyncio 协程 vs 线程**

asyncio 的优势在于：协程切换比线程切换轻量得多（不需要内核介入），共享数据无需加锁（同一时刻只有一个协程在执行）。缺点：所有操作必须是非阻塞的，一旦有 CPU 密集型操作就会阻塞整个事件循环。

**4. 协议兼容性的价值**

因为严格遵循 RESP2 协议，`redis-cli`、各种 Redis 客户端库（redis-py、ioredis 等）都可以直接连接 mini-redis 使用。这说明：**协议是接口，实现可以替换**。

**5. 最小实现揭示了核心**

真实 Redis 的代码库有 10 万行以上，但其中的核心——协议解析、键值存储、TTL 管理——只需要 ~180 行就能清晰表达。剩下的都是性能优化、边界处理和功能扩展。
