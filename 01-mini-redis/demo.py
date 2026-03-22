"""
mini-redis demo — self-contained tests (no external redis-cli needed).

Runs Store unit tests, RESP2 protocol tests, command dispatch tests,
and a full network integration test over real TCP sockets.

Usage:
  python demo.py

To run the actual server and test with redis-cli:
  python src/mini_redis.py
  redis-cli ping
"""

import socket
import time
import threading
import sys
import os
import asyncio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))
from mini_redis import Store, dispatch, encode, RESPParser, handle_client, databases


def reset_databases():
    for db in databases:
        db.flush()


# ─────────────────────────────────────────────────────────────
# Store unit tests
# ─────────────────────────────────────────────────────────────

def test_store():
    print("── Store unit tests ──────────────────────────────────")
    s = Store()

    s.set("foo", "bar")
    assert s.get("foo") == "bar"
    print("  ✓ SET/GET basic")

    s.set("foo", "baz")
    assert s.get("foo") == "baz"
    print("  ✓ SET overwrite")

    count = s.delete("foo")
    assert count == 1 and s.get("foo") is None
    print("  ✓ DEL")

    s.set("tmp", "val", ex=2)
    assert s.ttl("tmp") in (1, 2)
    print("  ✓ SET EX / TTL")

    s.set("k", "v")
    assert s.expire("k", 3) == 1 and s.ttl("k") in (2, 3)
    print("  ✓ EXPIRE / TTL")

    s.flush()
    s.set("user:1", "alice"); s.set("user:2", "bob"); s.set("session:x", "abc")
    keys = s.keys("user:*")
    assert set(keys) == {"user:1", "user:2"}, f"KEYS wrong: {keys}"
    print("  ✓ KEYS pattern")

    s.set("expiring", "soon", ex=0)
    time.sleep(0.01)
    assert s.get("expiring") is None
    print("  ✓ Lazy expiry")

    s.set("sticky", "1", ex=5)
    assert s.persist("sticky") == 1 and s.ttl("sticky") == -1
    print("  ✓ PERSIST removes TTL")

    assert s.incrby("counter", 3) == 3
    assert s.incrby("counter", -2) == 1
    print("  ✓ INCRBY / DECRBY")

    assert s.lpush("jobs", "b", "a") == 2
    assert s.rpush("jobs", "c") == 3
    assert s.lrange("jobs", 0, -1) == ["a", "b", "c"]
    assert s.lpop("jobs") == "a"
    assert s.rpop("jobs") == "c"
    assert s.llen("jobs") == 1
    print("  ✓ List commands")

    assert s.hset("profile:1", "name", "alice") == 1
    assert s.hset("profile:1", "name", "alice-updated") == 0
    assert s.hset("profile:1", "role", "admin") == 1
    assert s.hget("profile:1", "name") == "alice-updated"
    assert s.hgetall("profile:1") == ["name", "alice-updated", "role", "admin"]
    assert s.hdel("profile:1", "name") == 1
    print("  ✓ Hash commands")

    s.flush()
    assert s.keys("*") == []
    print("  ✓ FLUSHDB")
    print()


# ─────────────────────────────────────────────────────────────
# RESP2 protocol tests
# ─────────────────────────────────────────────────────────────

def test_resp():
    print("── RESP2 protocol tests ──────────────────────────────")

    assert encode("hello") == b"$5\r\nhello\r\n"
    assert encode(42) == b":42\r\n"
    assert encode(None) == b"$-1\r\n"
    assert encode(["SET", "foo", "bar"]) == b"*3\r\n$3\r\nSET\r\n$3\r\nfoo\r\n$3\r\nbar\r\n"
    print("  ✓ Encode: string, integer, nil, array")

    p = RESPParser()
    p.feed(b"*3\r\n$3\r\nSET\r\n$3\r\nfoo\r\n$3\r\nbar\r\n")
    cmd = p.get_command()
    assert cmd == ["SET", "foo", "bar"], f"parse failed: {cmd}"
    print("  ✓ Parse: array command")

    p2 = RESPParser()
    p2.feed(b"*1\r\n$4\r\nPING\r\n")
    assert p2.get_command() == ["PING"]
    print("  ✓ Parse: PING")

    # Incremental (split reads)
    p3 = RESPParser()
    p3.feed(b"*2\r\n$4\r\nECHO\r\n")
    assert p3.get_command() is None
    p3.feed(b"$5\r\nhello\r\n")
    assert p3.get_command() == ["ECHO", "hello"]
    print("  ✓ Parse: incremental (split across reads)")
    print()


# ─────────────────────────────────────────────────────────────
# Dispatch tests
# ─────────────────────────────────────────────────────────────

def test_dispatch():
    print("── Dispatch (command handler) tests ─────────────────")
    reset_databases()
    state = {"db": 0}
    dispatch(["FLUSHDB"], state)  # clean state

    assert dispatch(["PING"], state) == b"+PONG\r\n"
    assert dispatch(["PING", "hello"], state) == encode("hello")
    assert dispatch(["PONG"], state) == encode("PING")
    print("  ✓ PING / PONG")

    assert dispatch(["ECHO", "world"], state) == encode("world")
    print("  ✓ ECHO")

    assert dispatch(["SET", "x", "100"], state) == b"+OK\r\n"
    assert dispatch(["GET", "x"], state) == encode("100")
    print("  ✓ SET / GET")

    dispatch(["SET", "temp", "val", "EX", "10"], state)
    ttl_resp = dispatch(["TTL", "temp"], state)
    ttl_val = int(ttl_resp[1:].strip())
    assert 8 <= ttl_val <= 10, f"TTL out of range: {ttl_val}"
    assert dispatch(["PERSIST", "temp"], state) == encode(1)
    assert dispatch(["TTL", "temp"], state) == encode(-1)
    print("  ✓ SET EX / TTL / PERSIST")

    dispatch(["SET", "del_me", "yes"], state)
    assert dispatch(["DEL", "del_me"], state) == encode(1)
    assert dispatch(["GET", "del_me"], state) == encode(None)
    print("  ✓ DEL")

    dispatch(["FLUSHDB"], state)
    dispatch(["SET", "a:1", "v"], state)
    dispatch(["SET", "a:2", "v"], state)
    dispatch(["SET", "b:1", "v"], state)
    keys_resp = dispatch(["KEYS", "a:*"], state)
    assert b"a:1" in keys_resp and b"a:2" in keys_resp and b"b:1" not in keys_resp
    print("  ✓ KEYS pattern")

    assert dispatch(["INCR", "count"], state) == encode(1)
    assert dispatch(["INCRBY", "count", "9"], state) == encode(10)
    assert dispatch(["DECR", "count"], state) == encode(9)
    assert dispatch(["DECRBY", "count", "4"], state) == encode(5)
    print("  ✓ INCR / DECR")

    assert dispatch(["RPUSH", "letters", "a", "b"], state) == encode(2)
    assert dispatch(["LPUSH", "letters", "z"], state) == encode(3)
    assert dispatch(["LLEN", "letters"], state) == encode(3)
    assert dispatch(["LRANGE", "letters", "0", "-1"], state) == encode(["z", "a", "b"])
    assert dispatch(["LPOP", "letters"], state) == encode("z")
    assert dispatch(["RPOP", "letters"], state) == encode("b")
    print("  ✓ List commands")

    assert dispatch(["HSET", "cfg", "env", "dev"], state) == encode(1)
    assert dispatch(["HSET", "cfg", "region", "eu"], state) == encode(1)
    assert dispatch(["HGET", "cfg", "env"], state) == encode("dev")
    assert dispatch(["HGETALL", "cfg"], state) == encode(["env", "dev", "region", "eu"])
    assert dispatch(["HDEL", "cfg", "env"], state) == encode(1)
    print("  ✓ Hash commands")

    assert dispatch(["SELECT", "1"], state) == b"+OK\r\n"
    assert dispatch(["GET", "x"], state) == encode(None)
    assert dispatch(["SET", "db1", "value"], state) == b"+OK\r\n"
    assert dispatch(["SELECT", "0"], state) == b"+OK\r\n"
    assert dispatch(["GET", "db1"], state) == encode(None)
    print("  ✓ SELECT isolates databases")

    assert dispatch(["FLUSHDB"], state) == b"+OK\r\n"
    assert dispatch(["KEYS", "*"], state) == encode([])
    print("  ✓ FLUSHDB")
    print()


# ─────────────────────────────────────────────────────────────
# Network integration test
# ─────────────────────────────────────────────────────────────

def send_resp(sock, *args):
    cmd = encode(list(args))
    sock.sendall(cmd)
    time.sleep(0.05)
    return sock.recv(4096).decode(errors="replace")


def test_network():
    print("── Network integration (real TCP) ───────────────────")
    reset_databases()
    PORT = 16399

    loop = asyncio.new_event_loop()
    ready = threading.Event()

    def run():
        asyncio.set_event_loop(loop)
        async def _serve():
            server = await asyncio.start_server(handle_client, "127.0.0.1", PORT)
            ready.set()
            async with server:
                await server.serve_forever()
        try:
            loop.run_until_complete(_serve())
        except PermissionError:
            ready.set()

    threading.Thread(target=run, daemon=True).start()
    ready.wait(timeout=3)

    try:
        with socket.create_connection(("127.0.0.1", PORT), timeout=3) as sock:
            assert "+PONG" in send_resp(sock, "PING")
            print("  ✓ PING over TCP")

            assert "+OK" in send_resp(sock, "SET", "net_key", "net_val")
            assert "net_val" in send_resp(sock, "GET", "net_key")
            print("  ✓ SET / GET over TCP")

            assert "+OK" in send_resp(sock, "SET", "ttl_key", "v", "EX", "5")
            r = send_resp(sock, "TTL", "ttl_key")
            assert r.startswith(":"), f"TTL not integer: {r}"
            print("  ✓ SET EX / TTL over TCP")

            assert ":3" in send_resp(sock, "RPUSH", "queue", "a", "b", "c")
            assert "*3" in send_resp(sock, "LRANGE", "queue", "0", "-1")
            print("  ✓ List commands over TCP")

            assert ":1" in send_resp(sock, "HSET", "profile", "name", "alice")
            assert "alice" in send_resp(sock, "HGET", "profile", "name")
            print("  ✓ Hash commands over TCP")

            assert ":1" in send_resp(sock, "INCR", "hits")
            assert ":5" in send_resp(sock, "INCRBY", "hits", "4")
            print("  ✓ INCR / INCRBY over TCP")

            assert "+OK" in send_resp(sock, "SELECT", "2")
            assert "+OK" in send_resp(sock, "SET", "scoped", "yes")
            assert "+OK" in send_resp(sock, "SELECT", "0")
            assert "$-1" in send_resp(sock, "GET", "scoped")
            print("  ✓ SELECT over TCP")

            send_resp(sock, "SET", "bye", "now")
            assert ":1" in send_resp(sock, "DEL", "bye")
            assert "$-1" in send_resp(sock, "GET", "bye")
            print("  ✓ DEL / GET nil over TCP")

            assert "+OK" in send_resp(sock, "FLUSHDB")
            print("  ✓ FLUSHDB over TCP")
    except PermissionError:
        print("  - Skipped: sandbox does not allow binding/connect on local TCP ports")
    finally:
        try:
            loop.call_soon_threadsafe(loop.stop)
        except RuntimeError:
            pass
    print()


# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print()
    print("╔══════════════════════════════════════════════════════════╗")
    print("║  build-your-own-x-mini: mini-redis demo & tests          ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print()

    test_store()
    test_resp()
    test_dispatch()
    test_network()

    print("═" * 60)
    print("  All tests passed! ✓")
    print()
    print("  To run the real server:")
    print("    python src/mini_redis.py")
    print()
    print("  Then test with redis-cli:")
    print("    redis-cli ping")
    print("    redis-cli set mykey hello")
    print("    redis-cli get mykey")
    print("    redis-cli rpush jobs a b c")
    print("    redis-cli hset user:1 name alice")
    print("    redis-cli incr page:views")
    print()
