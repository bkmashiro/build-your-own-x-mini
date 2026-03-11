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
from mini_redis import Store, dispatch, encode, RESPParser, handle_client


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
    dispatch(["FLUSHDB"])  # clean state

    assert dispatch(["PING"]) == b"+PONG\r\n"
    assert dispatch(["PING", "hello"]) == encode("hello")
    print("  ✓ PING")

    assert dispatch(["ECHO", "world"]) == encode("world")
    print("  ✓ ECHO")

    assert dispatch(["SET", "x", "100"]) == b"+OK\r\n"
    assert dispatch(["GET", "x"]) == encode("100")
    print("  ✓ SET / GET")

    dispatch(["SET", "temp", "val", "EX", "10"])
    ttl_resp = dispatch(["TTL", "temp"])
    ttl_val = int(ttl_resp[1:].strip())
    assert 8 <= ttl_val <= 10, f"TTL out of range: {ttl_val}"
    print("  ✓ SET EX / TTL")

    dispatch(["SET", "del_me", "yes"])
    assert dispatch(["DEL", "del_me"]) == encode(1)
    assert dispatch(["GET", "del_me"]) == encode(None)
    print("  ✓ DEL")

    dispatch(["FLUSHDB"])
    dispatch(["SET", "a:1", "v"]); dispatch(["SET", "a:2", "v"]); dispatch(["SET", "b:1", "v"])
    keys_resp = dispatch(["KEYS", "a:*"])
    assert b"a:1" in keys_resp and b"a:2" in keys_resp and b"b:1" not in keys_resp
    print("  ✓ KEYS pattern")

    assert dispatch(["FLUSHDB"]) == b"+OK\r\n"
    assert dispatch(["KEYS", "*"]) == encode([])
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
        loop.run_until_complete(_serve())

    threading.Thread(target=run, daemon=True).start()
    ready.wait(timeout=3)

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

        send_resp(sock, "SET", "bye", "now")
        assert ":1" in send_resp(sock, "DEL", "bye")
        assert "$-1" in send_resp(sock, "GET", "bye")
        print("  ✓ DEL / GET nil over TCP")

        assert "+OK" in send_resp(sock, "FLUSHDB")
        print("  ✓ FLUSHDB over TCP")

    loop.call_soon_threadsafe(loop.stop)
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
    print("    redis-cli set tmp 42 ex 10")
    print("    redis-cli ttl tmp")
    print()
