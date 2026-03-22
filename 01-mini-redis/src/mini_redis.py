"""
mini-redis — A minimal Redis server in Python.

Implements:
  - RESP2 protocol (serialization/deserialization)
  - String, List, Hash data types
  - TTL with lazy expiry
  - Atomic counters and multiple logical DBs
  - asyncio TCP server — redis-cli compatible
"""

import asyncio
import time
import fnmatch
import argparse
from typing import Any


# ─────────────────────────────────────────────────────────────
# RESP2 Protocol
# ─────────────────────────────────────────────────────────────
# Redis Serialization Protocol (RESP2):
#   Simple String:  +OK\r\n
#   Error:          -ERR message\r\n
#   Integer:        :42\r\n
#   Bulk String:    $5\r\nhello\r\n   ($-1\r\n = nil)
#   Array:          *3\r\n$3\r\nSET\r\n$3\r\nfoo\r\n$3\r\nbar\r\n

def encode(value: Any) -> bytes:
    """Encode a Python value to RESP2 bytes."""
    if value is None:
        return b"$-1\r\n"                            # nil bulk string
    elif isinstance(value, bool):
        return f":{1 if value else 0}\r\n".encode()
    elif isinstance(value, int):
        return f":{value}\r\n".encode()
    elif isinstance(value, str):
        data = value.encode()
        return f"${len(data)}\r\n".encode() + data + b"\r\n"
    elif isinstance(value, bytes):
        return f"${len(value)}\r\n".encode() + value + b"\r\n"
    elif isinstance(value, list):
        parts = [f"*{len(value)}\r\n".encode()]
        for item in value:
            parts.append(encode(item))
        return b"".join(parts)
    elif isinstance(value, Exception):
        return f"-ERR {value}\r\n".encode()
    else:
        raise TypeError(f"Cannot encode {type(value)}")

def encode_ok() -> bytes:
    return b"+OK\r\n"

def encode_error(msg: str) -> bytes:
    return f"-ERR {msg}\r\n".encode()


class RESPParser:
    """Incremental RESP2 parser. Feed bytes, pull out complete commands."""

    def __init__(self):
        self.buf = b""

    def feed(self, data: bytes):
        self.buf += data

    def parse_one(self) -> tuple[Any, int] | None:
        """
        Parse one value from self.buf.
        Returns (value, bytes_consumed) or None if incomplete.
        """
        if not self.buf:
            return None
        prefix = chr(self.buf[0])

        if prefix == '+':   # Simple string
            end = self.buf.find(b"\r\n")
            if end == -1: return None
            return self.buf[1:end].decode(), end + 2

        elif prefix == '-':  # Error
            end = self.buf.find(b"\r\n")
            if end == -1: return None
            return Exception(self.buf[1:end].decode()), end + 2

        elif prefix == ':':  # Integer
            end = self.buf.find(b"\r\n")
            if end == -1: return None
            return int(self.buf[1:end]), end + 2

        elif prefix == '$':  # Bulk string
            end = self.buf.find(b"\r\n")
            if end == -1: return None
            length = int(self.buf[1:end])
            if length == -1:
                return None, end + 2  # nil
            start = end + 2
            if len(self.buf) < start + length + 2:
                return None  # need more data
            return self.buf[start:start + length].decode(), start + length + 2

        elif prefix == '*':  # Array
            end = self.buf.find(b"\r\n")
            if end == -1: return None
            count = int(self.buf[1:end])
            if count == -1: return None, end + 2
            items = []
            pos = end + 2
            saved_buf = self.buf
            self.buf = self.buf[pos:]
            for _ in range(count):
                result = self.parse_one()
                if result is None:
                    self.buf = saved_buf
                    return None
                val, consumed = result
                items.append(val)
                self.buf = self.buf[consumed:]
            consumed_total = len(saved_buf) - len(self.buf)
            self.buf = saved_buf
            return items, consumed_total

        return None  # unknown prefix

    def get_command(self) -> list[str] | None:
        """Return next complete command (list of strings) or None."""
        result = self.parse_one()
        if result is None:
            return None
        value, consumed = result
        self.buf = self.buf[consumed:]
        if isinstance(value, list):
            return [str(v) for v in value]
        return [str(value)]  # inline command


# ─────────────────────────────────────────────────────────────
# In-Memory Store
# ─────────────────────────────────────────────────────────────

class RedisError(Exception):
    pass


class WrongTypeError(RedisError):
    pass


class Store:
    def __init__(self):
        self._data: dict[str, Any] = {}
        self._expires: dict[str, float] = {}  # key → unix timestamp

    def _is_expired(self, key: str) -> bool:
        if key in self._expires:
            if time.time() > self._expires[key]:
                # Lazy deletion: remove on access
                del self._data[key]
                del self._expires[key]
                return True
        return False

    def _exists(self, key: str) -> bool:
        return key in self._data and not self._is_expired(key)

    def _require_type(self, key: str, expected: type, kind: str):
        if self._is_expired(key):
            return None
        value = self._data.get(key)
        if value is None:
            return None
        if not isinstance(value, expected):
            raise WrongTypeError(
                f"WRONGTYPE Operation against a key holding the wrong kind of value; expected {kind}"
            )
        return value

    def get(self, key: str) -> str | None:
        if self._is_expired(key): return None
        value = self._data.get(key)
        if value is None:
            return None
        if not isinstance(value, str):
            raise WrongTypeError(
                "WRONGTYPE Operation against a key holding the wrong kind of value; expected string"
            )
        return value

    def set(self, key: str, value: str, ex: int | None = None, px: int | None = None):
        self._data[key] = value
        self._expires.pop(key, None)  # clear any existing TTL
        if ex is not None:
            self._expires[key] = time.time() + ex
        elif px is not None:
            self._expires[key] = time.time() + px / 1000

    def delete(self, *keys: str) -> int:
        deleted = 0
        for k in keys:
            if self._is_expired(k):
                continue
            if k in self._data:
                del self._data[k]
                self._expires.pop(k, None)
                deleted += 1
        return deleted

    def expire(self, key: str, seconds: int) -> int:
        if key not in self._data or self._is_expired(key):
            return 0
        self._expires[key] = time.time() + seconds
        return 1

    def persist(self, key: str) -> int:
        if not self._exists(key):
            return 0
        return 1 if self._expires.pop(key, None) is not None else 0

    def ttl(self, key: str) -> int:
        if key not in self._data or self._is_expired(key):
            return -2  # key doesn't exist
        if key not in self._expires:
            return -1  # no expiry
        remaining = int(self._expires[key] - time.time())
        return max(0, remaining)

    def keys(self, pattern: str = "*") -> list[str]:
        # Evict expired keys first (partial scan)
        live = [k for k in list(self._data) if not self._is_expired(k)]
        return [k for k in live if fnmatch.fnmatch(k, pattern)]

    def incrby(self, key: str, amount: int) -> int:
        if self._is_expired(key):
            current = 0
        elif key not in self._data:
            current = 0
        else:
            value = self._data[key]
            if not isinstance(value, str):
                raise WrongTypeError(
                    "WRONGTYPE Operation against a key holding the wrong kind of value; expected string"
                )
            try:
                current = int(value)
            except ValueError as exc:
                raise RedisError("value is not an integer or out of range") from exc
        current += amount
        self._data[key] = str(current)
        return current

    def lpush(self, key: str, *values: str) -> int:
        items = self._require_type(key, list, "list")
        if items is None:
            items = []
            self._data[key] = items
        for value in values:
            items.insert(0, value)
        return len(items)

    def rpush(self, key: str, *values: str) -> int:
        items = self._require_type(key, list, "list")
        if items is None:
            items = []
            self._data[key] = items
        items.extend(values)
        return len(items)

    def lpop(self, key: str) -> str | None:
        items = self._require_type(key, list, "list")
        if not items:
            return None
        value = items.pop(0)
        if not items:
            self.delete(key)
        return value

    def rpop(self, key: str) -> str | None:
        items = self._require_type(key, list, "list")
        if not items:
            return None
        value = items.pop()
        if not items:
            self.delete(key)
        return value

    def llen(self, key: str) -> int:
        items = self._require_type(key, list, "list")
        return 0 if items is None else len(items)

    def lrange(self, key: str, start: int, stop: int) -> list[str]:
        items = self._require_type(key, list, "list")
        if items is None:
            return []
        size = len(items)
        if start < 0:
            start += size
        if stop < 0:
            stop += size
        start = max(start, 0)
        stop = min(stop, size - 1)
        if start > stop or start >= size:
            return []
        return items[start:stop + 1]

    def hset(self, key: str, field: str, value: str) -> int:
        mapping = self._require_type(key, dict, "hash")
        if mapping is None:
            mapping = {}
            self._data[key] = mapping
        is_new = field not in mapping
        mapping[field] = value
        return 1 if is_new else 0

    def hget(self, key: str, field: str) -> str | None:
        mapping = self._require_type(key, dict, "hash")
        if mapping is None:
            return None
        return mapping.get(field)

    def hdel(self, key: str, *fields: str) -> int:
        mapping = self._require_type(key, dict, "hash")
        if mapping is None:
            return 0
        deleted = 0
        for field in fields:
            if field in mapping:
                del mapping[field]
                deleted += 1
        if not mapping:
            self.delete(key)
        return deleted

    def hgetall(self, key: str) -> list[str]:
        mapping = self._require_type(key, dict, "hash")
        if mapping is None:
            return []
        result: list[str] = []
        for field, value in mapping.items():
            result.extend([field, value])
        return result

    def flush(self):
        self._data.clear()
        self._expires.clear()


# ─────────────────────────────────────────────────────────────
# Command Dispatcher
# ─────────────────────────────────────────────────────────────

databases: list[Store] = [Store()]


def get_store(db_index: int) -> Store:
    while db_index >= len(databases):
        databases.append(Store())
    return databases[db_index]


def parse_int(value: str, message: str = "value is not an integer or out of range") -> int:
    try:
        return int(value)
    except ValueError as exc:
        raise RedisError(message) from exc


def dispatch(args: list[str], state: dict[str, int] | None = None) -> bytes:
    if not args:
        return encode_error("empty command")
    if state is None:
        state = {"db": 0}
    cmd = args[0].upper()
    store = get_store(state["db"])

    try:
        if cmd == "PING":
            msg = args[1] if len(args) > 1 else "PONG"
            return encode(msg) if len(args) > 1 else b"+PONG\r\n"

        elif cmd == "PONG":
            msg = args[1] if len(args) > 1 else "PING"
            return encode(msg)

        elif cmd == "ECHO":
            return encode(args[1]) if len(args) > 1 else encode_error("wrong number of args")

        elif cmd == "SET":
            if len(args) < 3:
                return encode_error("wrong number of args for SET")
            key, value = args[1], args[2]
            ex = px = None
            i = 3
            while i < len(args):
                opt = args[i].upper()
                if opt == "EX" and i + 1 < len(args):
                    ex = parse_int(args[i + 1]); i += 2
                elif opt == "PX" and i + 1 < len(args):
                    px = parse_int(args[i + 1]); i += 2
                else:
                    i += 1
            store.set(key, value, ex=ex, px=px)
            return encode_ok()

        elif cmd == "GET":
            if len(args) < 2:
                return encode_error("wrong number of args")
            return encode(store.get(args[1]))

        elif cmd == "DEL":
            if len(args) < 2:
                return encode_error("wrong number of args")
            return encode(store.delete(*args[1:]))

        elif cmd == "EXPIRE":
            if len(args) < 3:
                return encode_error("wrong number of args")
            return encode(store.expire(args[1], parse_int(args[2])))

        elif cmd == "PERSIST":
            if len(args) != 2:
                return encode_error("wrong number of args")
            return encode(store.persist(args[1]))

        elif cmd == "TTL":
            if len(args) < 2:
                return encode_error("wrong number of args")
            return encode(store.ttl(args[1]))

        elif cmd == "INCR":
            if len(args) != 2:
                return encode_error("wrong number of args")
            return encode(store.incrby(args[1], 1))

        elif cmd == "INCRBY":
            if len(args) != 3:
                return encode_error("wrong number of args")
            return encode(store.incrby(args[1], parse_int(args[2])))

        elif cmd == "DECR":
            if len(args) != 2:
                return encode_error("wrong number of args")
            return encode(store.incrby(args[1], -1))

        elif cmd == "DECRBY":
            if len(args) != 3:
                return encode_error("wrong number of args")
            return encode(store.incrby(args[1], -parse_int(args[2])))

        elif cmd == "LPUSH":
            if len(args) < 3:
                return encode_error("wrong number of args")
            return encode(store.lpush(args[1], *args[2:]))

        elif cmd == "RPUSH":
            if len(args) < 3:
                return encode_error("wrong number of args")
            return encode(store.rpush(args[1], *args[2:]))

        elif cmd == "LPOP":
            if len(args) != 2:
                return encode_error("wrong number of args")
            return encode(store.lpop(args[1]))

        elif cmd == "RPOP":
            if len(args) != 2:
                return encode_error("wrong number of args")
            return encode(store.rpop(args[1]))

        elif cmd == "LLEN":
            if len(args) != 2:
                return encode_error("wrong number of args")
            return encode(store.llen(args[1]))

        elif cmd == "LRANGE":
            if len(args) != 4:
                return encode_error("wrong number of args")
            return encode(store.lrange(args[1], parse_int(args[2]), parse_int(args[3])))

        elif cmd == "HSET":
            if len(args) != 4:
                return encode_error("wrong number of args")
            return encode(store.hset(args[1], args[2], args[3]))

        elif cmd == "HGET":
            if len(args) != 3:
                return encode_error("wrong number of args")
            return encode(store.hget(args[1], args[2]))

        elif cmd == "HDEL":
            if len(args) < 3:
                return encode_error("wrong number of args")
            return encode(store.hdel(args[1], *args[2:]))

        elif cmd == "HGETALL":
            if len(args) != 2:
                return encode_error("wrong number of args")
            return encode(store.hgetall(args[1]))

        elif cmd == "SELECT":
            if len(args) != 2:
                return encode_error("wrong number of args")
            db_index = parse_int(args[1], "DB index is out of range")
            if db_index < 0:
                return encode_error("DB index is out of range")
            state["db"] = db_index
            get_store(db_index)
            return encode_ok()

        elif cmd == "KEYS":
            pattern = args[1] if len(args) > 1 else "*"
            return encode(store.keys(pattern))

        elif cmd == "FLUSHDB":
            store.flush()
            return encode_ok()

        elif cmd == "DBSIZE":
            return encode(len(store.keys("*")))

        elif cmd == "COMMAND":
            return encode([])

        else:
            return encode_error(f"unknown command '{args[0]}'")
    except RedisError as exc:
        return encode_error(str(exc))


# ─────────────────────────────────────────────────────────────
# Async TCP Server
# ─────────────────────────────────────────────────────────────

async def handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    parser = RESPParser()
    state = {"db": 0}
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
                response = dispatch(cmd, state)
                writer.write(response)
                await writer.drain()
    except (ConnectionResetError, BrokenPipeError):
        pass
    finally:
        writer.close()


async def main(host: str = "127.0.0.1", port: int = 6399):
    server = await asyncio.start_server(handle_client, host, port)
    print(f"mini-redis listening on {host}:{port}")
    print(f"Connect with: redis-cli -p {port}")
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="mini-redis server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=6399)
    args = parser.parse_args()
    asyncio.run(main(args.host, args.port))
