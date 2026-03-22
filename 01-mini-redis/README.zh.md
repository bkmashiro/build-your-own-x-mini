# 01 - mini-redis 最小 Redis 实现

[English](README.md)

> 用 Python 实现的最小 Redis 克隆版，支持 RESP2、多数据类型、TTL 和多 DB。

## 已实现功能

- RESP2 协议解析与编码
- 字符串命令：`SET`、`GET`、`DEL`
- 原子计数：`INCR`、`INCRBY`、`DECR`、`DECRBY`
- List 命令：`LPUSH`、`RPUSH`、`LPOP`、`RPOP`、`LLEN`、`LRANGE`
- Hash 命令：`HSET`、`HGET`、`HDEL`、`HGETALL`
- TTL 命令：`EXPIRE`、`TTL`、`PERSIST`
- 连接/管理命令：`PING`、`PONG`、`ECHO`、`KEYS`、`DBSIZE`、`FLUSHDB`、`SELECT`、`COMMAND`
- 基于 `asyncio` 的 TCP 服务，可直接用 `redis-cli` 连接

## 快速运行

启动服务：

```bash
python 01-mini-redis/src/mini_redis.py
```

另一终端测试：

```bash
redis-cli -p 6399 ping
redis-cli -p 6399 set counter 10
redis-cli -p 6399 incr counter
redis-cli -p 6399 rpush jobs a b c
redis-cli -p 6399 lrange jobs 0 -1
redis-cli -p 6399 hset user:1 name alice
redis-cli -p 6399 hgetall user:1
redis-cli -p 6399 select 1
redis-cli -p 6399 set scoped yes
```

运行演示与自测：

```bash
python 01-mini-redis/demo.py
```

## 命令分组

| 分组 | 命令 |
|---|---|
| 连接 | `PING`、`PONG`、`ECHO`、`COMMAND` |
| 字符串 | `SET`、`GET`、`DEL` |
| 计数器 | `INCR`、`INCRBY`、`DECR`、`DECRBY` |
| List | `LPUSH`、`RPUSH`、`LPOP`、`RPOP`、`LLEN`、`LRANGE` |
| Hash | `HSET`、`HGET`、`HDEL`、`HGETALL` |
| 过期控制 | `EXPIRE`、`TTL`、`PERSIST` |
| DB 管理 | `SELECT`、`KEYS`、`DBSIZE`、`FLUSHDB` |

## 核心实现

整体结构仍然是四层：

1. `asyncio.start_server()` 负责 TCP 连接。
2. `RESPParser` 把字节流解析成 Redis 命令数组。
3. `dispatch()` 负责命令路由，并维护每个连接当前选中的 DB。
4. `Store` 负责真正的数据存储与 TTL。

### 数据模型

每个逻辑 DB 对应一个独立的 `Store`，内部有两个字典：

- `_data`：保存实际值
- `_expires`：保存带 TTL 键的过期时间戳

不同 Redis 类型直接映射到 Python 类型：

- String -> `str`
- List -> `list[str]`
- Hash -> `dict[str, str]`

如果命令访问了错误的数据类型，会返回 Redis 风格的 `WRONGTYPE` 错误。

### TTL 与 PERSIST

这个 mini-redis 只实现懒惰过期：

- 访问键时检查是否过期
- 过期则立即删除
- 不启动后台扫描线程

`PERSIST` 会移除键的 TTL，但不改变值本身。

### SELECT 多 DB

`SELECT n` 会切换当前连接正在操作的逻辑数据库。不同 DB 的键空间彼此隔离：

```text
127.0.0.1:6399> set name db0
OK
127.0.0.1:6399> select 1
OK
127.0.0.1:6399> get name
(nil)
```

## 示例

```text
127.0.0.1:6399> incr visits
(integer) 1
127.0.0.1:6399> rpush queue a b c
(integer) 3
127.0.0.1:6399> lrange queue 0 -1
1) "a"
2) "b"
3) "c"
127.0.0.1:6399> hset user:1 name alice
(integer) 1
127.0.0.1:6399> expire user:1 10
(integer) 1
127.0.0.1:6399> persist user:1
(integer) 1
```

## 暂未实现

- 持久化：`RDB` / `AOF`
- Pub/Sub、Streams、有序集合
- 主从复制、集群、事务
