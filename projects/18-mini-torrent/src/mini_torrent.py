"""mini-torrent - tiny DHT discovery, peer wire helpers, and rarest-first."""

from __future__ import annotations

import os, random, socket, struct
from collections import Counter


def benc(v):
    if isinstance(v, int): return f"i{v}e".encode()
    if isinstance(v, bytes): return str(len(v)).encode() + b":" + v
    if isinstance(v, str): return benc(v.encode())
    if isinstance(v, list): return b"l" + b"".join(benc(x) for x in v) + b"e"
    if isinstance(v, dict): return b"d" + b"".join(benc(k) + benc(v[k]) for k in sorted(v)) + b"e"
    raise TypeError(type(v))


def bdec(buf, i=0):
    c = buf[i:i + 1]
    if c == b"i":
        j = buf.index(b"e", i)
        return int(buf[i + 1:j]), j + 1
    if c == b"l":
        out, i = [], i + 1
        while buf[i:i + 1] != b"e":
            v, i = bdec(buf, i)
            out.append(v)
        return out, i + 1
    if c == b"d":
        out, i = {}, i + 1
        while buf[i:i + 1] != b"e":
            k, i = bdec(buf, i)
            v, i = bdec(buf, i)
            out[k] = v
        return out, i + 1
    j = buf.index(b":", i)
    n = int(buf[i:j])
    return buf[j + 1:j + 1 + n], j + 1 + n


def decode(buf): return bdec(buf)[0]
def nid(): return os.urandom(20)


def parse_nodes(blob):
    out = []
    for i in range(0, len(blob), 26):
        chunk = blob[i:i + 26]
        if len(chunk) == 26:
            out.append((chunk[:20].hex(), socket.inet_ntoa(chunk[20:24]), struct.unpack("!H", chunk[24:])[0]))
    return out


def compact(node_id, ip, port):
    return bytes.fromhex(node_id) + socket.inet_aton(ip) + struct.pack("!H", port)


class DHTNode:
    def __init__(self, bootstrap, node_id=None, timeout=1.0):
        self.node_id, self.bootstrap = node_id or nid(), bootstrap
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.settimeout(timeout)

    def query(self, addr, q, **a):
        tx = os.urandom(2)
        msg = {b"t": tx, b"y": b"q", b"q": q.encode(), b"a": {b"id": self.node_id, **{k.encode(): v for k, v in a.items()}}}
        self.sock.sendto(benc(msg), addr)
        while True:
            data, src = self.sock.recvfrom(2048)
            res = decode(data)
            if src == addr and res.get(b"t") == tx:
                return res

    def discover(self, info_hash=b"\0" * 20, target=None):
        target = target or nid()
        found = []
        for q, extra in (("find_node", {"target": target}), ("get_peers", {"info_hash": info_hash})):
            try:
                res = self.query(self.bootstrap, q, **extra)
                found.extend(parse_nodes(res.get(b"r", {}).get(b"nodes", b"")))
            except OSError:
                pass
        seen, out = set(), []
        for node in found:
            if node[0] not in seen:
                seen.add(node[0]); out.append(node)
        return out


class PeerWire:
    PSTR = b"BitTorrent protocol"
    IDS = {0: "choke", 1: "unchoke", 2: "interested", 4: "have", 5: "bitfield", 6: "request", 7: "piece"}

    @staticmethod
    def handshake(info_hash, peer_id, reserved=b"\0" * 8):
        return struct.pack("!B", len(PeerWire.PSTR)) + PeerWire.PSTR + reserved + info_hash + peer_id

    @staticmethod
    def parse_handshake(buf):
        p = buf[0]
        return {"pstr": buf[1:1 + p].decode(), "reserved": buf[1 + p:9 + p], "info_hash": buf[9 + p:29 + p], "peer_id": buf[29 + p:49 + p]}

    @staticmethod
    def msg(msg_id, payload=b""):
        return struct.pack("!IB", len(payload) + 1, msg_id) + payload

    @staticmethod
    def parse_msg(buf):
        n = struct.unpack("!I", buf[:4])[0]
        if not n: return {"type": "keep-alive"}
        msg_id = buf[4]
        return {"type": PeerWire.IDS.get(msg_id, f"unknown-{msg_id}"), "payload": buf[5:4 + n]}


class PiecePicker:
    def __init__(self, total):
        self.missing, self.avail = set(range(total)), Counter()

    def observe(self, bitfield):
        for i, has in enumerate(bitfield):
            if has: self.avail[i] += 1

    def choose(self):
        options = [p for p in self.missing if self.avail[p]]
        if not options: return None
        rarest = min(self.avail[p] for p in options)
        pick = min(p for p in options if self.avail[p] == rarest)
        self.missing.remove(pick)
        return pick


def bitfield(bits):
    out = bytearray((len(bits) + 7) // 8)
    for i, bit in enumerate(bits):
        if bit: out[i // 8] |= 1 << (7 - i % 8)
    return bytes(out)
