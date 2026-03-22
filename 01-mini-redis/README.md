# mini-redis

> A minimal Redis clone in Python with RESP2, multiple data types, TTL, and multi-DB support.

## What it implements

- RESP2 protocol parsing/encoding
- String commands: `SET`, `GET`, `DEL`, `INCR`, `INCRBY`, `DECR`, `DECRBY`
- List commands: `LPUSH`, `RPUSH`, `LPOP`, `RPOP`, `LLEN`, `LRANGE`
- Hash commands: `HSET`, `HGET`, `HDEL`, `HGETALL`
- TTL commands: `EXPIRE`, `TTL`, `PERSIST`
- Utility commands: `PING`, `PONG`, `ECHO`, `KEYS`, `DBSIZE`, `FLUSHDB`, `SELECT`, `COMMAND`
- Lazy expiration and `redis-cli` compatibility over TCP

## Quick start

```bash
python 01-mini-redis/src/mini_redis.py
```

In another terminal:

```bash
redis-cli -p 6399 ping
redis-cli -p 6399 set counter 10
redis-cli -p 6399 incrby counter 5
redis-cli -p 6399 rpush jobs a b c
redis-cli -p 6399 lrange jobs 0 -1
redis-cli -p 6399 hset user:1 name alice
redis-cli -p 6399 hgetall user:1
redis-cli -p 6399 select 1
redis-cli -p 6399 set scoped yes
```

Or run the demo:

```bash
python 01-mini-redis/demo.py
```

## Supported commands

| Group | Commands |
|---|---|
| Connection | `PING`, `PONG`, `ECHO`, `COMMAND` |
| Strings | `SET`, `GET`, `DEL` |
| Counters | `INCR`, `INCRBY`, `DECR`, `DECRBY` |
| Lists | `LPUSH`, `RPUSH`, `LPOP`, `RPOP`, `LLEN`, `LRANGE` |
| Hashes | `HSET`, `HGET`, `HDEL`, `HGETALL` |
| Expiry | `EXPIRE`, `TTL`, `PERSIST` |
| Database | `SELECT`, `KEYS`, `DBSIZE`, `FLUSHDB` |

## How it works

The server still has the same four layers:

1. `asyncio.start_server()` accepts TCP connections.
2. `RESPParser` converts raw bytes into Redis command arrays.
3. `dispatch()` routes commands and keeps per-connection DB state for `SELECT`.
4. `Store` holds key/value data and a separate expiry map.

### Data model

Each logical DB is an independent `Store`. A store keeps:

- `_data`: Python values for Redis keys
- `_expires`: UNIX timestamps for keys with TTL

String values are stored as Python `str`, lists as `list[str]`, and hashes as `dict[str, str]`. Commands reject the wrong type with a Redis-style `WRONGTYPE` error.

### Lazy expiration

This project intentionally keeps expiry simple: keys are removed when they are accessed after their deadline. There is no background active-expiration loop.

## Example session

```text
127.0.0.1:6399> set visits 41
OK
127.0.0.1:6399> incr visits
(integer) 42
127.0.0.1:6399> rpush queue a b c
(integer) 3
127.0.0.1:6399> lpop queue
"a"
127.0.0.1:6399> hset user:1 name alice
(integer) 1
127.0.0.1:6399> expire user:1 10
(integer) 1
127.0.0.1:6399> persist user:1
(integer) 1
```

## Not implemented

- Persistence (`RDB` / `AOF`)
- Pub/Sub, Streams, Sorted Sets
- Replication, clustering, transactions
