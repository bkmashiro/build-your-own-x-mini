"""
mini-redis — A minimal Redis server in < 200 lines of Python.

Implements:
  - RESP2 protocol (serialization/deserialization)
  - Commands: PING, ECHO, SET, GET, DEL, EXPIRE, TTL, KEYS, FLUSHDB
  - In-memory store with lazy expiry (check TTL on access)
  - asyncio TCP server — real redis-cli compatible

Usage:
  python mini_redis.py            # starts on 127.0.0.1:6379
  python mini_redis.py --port 6380

Test with redis-cli:
  redis-cli ping
  redis-cli set foo bar
  redis-cli get foo
  redis-cli set tmp 42 ex 5
  redis-cli ttl tmp
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

class Store:
    def __init__(self):
        self._data: dict[str, str] = {}
        self._expires: dict[str, float] = {}  # key → unix timestamp

    def _is_expired(self, key: str) -> bool:
        if key in self._expires:
            if time.time() > self._expires[key]:
                # Lazy deletion: remove on access
                del self._data[key]
                del self._expires[key]
                return True
        return False

    def get(self, key: str) -> str | None:
        if self._is_expired(key): return None
        return self._data.get(key)

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

    def flush(self):
        self._data.clear()
        self._expires.clear()


# ─────────────────────────────────────────────────────────────
# Command Dispatcher
# ─────────────────────────────────────────────────────────────

store = Store()

def dispatch(args: list[str]) -> bytes:
    if not args:
        return encode_error("empty command")
    cmd = args[0].upper()

    if cmd == "PING":
        msg = args[1] if len(args) > 1 else "PONG"
        return encode(msg) if len(args) > 1 else b"+PONG\r\n"

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
                ex = int(args[i + 1]); i += 2
            elif opt == "PX" and i + 1 < len(args):
                px = int(args[i + 1]); i += 2
            else:
                i += 1
        store.set(key, value, ex=ex, px=px)
        return encode_ok()

    elif cmd == "GET":
        if len(args) < 2: return encode_error("wrong number of args")
        return encode(store.get(args[1]))

    elif cmd == "DEL":
        if len(args) < 2: return encode_error("wrong number of args")
        return encode(store.delete(*args[1:]))

    elif cmd == "EXPIRE":
        if len(args) < 3: return encode_error("wrong number of args")
        return encode(store.expire(args[1], int(args[2])))

    elif cmd == "TTL":
        if len(args) < 2: return encode_error("wrong number of args")
        return encode(store.ttl(args[1]))

    elif cmd == "KEYS":
        pattern = args[1] if len(args) > 1 else "*"
        return encode(store.keys(pattern))

    elif cmd == "FLUSHDB":
        store.flush()
        return encode_ok()

    elif cmd == "DBSIZE":
        # Return count of live (non-expired) keys
        return encode(len(store.keys("*")))

    elif cmd == "COMMAND":  # redis-cli sends this on connect
        return encode([])

    else:
        return encode_error(f"unknown command '{args[0]}'")


# ─────────────────────────────────────────────────────────────
# Async TCP Server
# ─────────────────────────────────────────────────────────────

async def handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    addr = writer.get_extra_info("peername")
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
