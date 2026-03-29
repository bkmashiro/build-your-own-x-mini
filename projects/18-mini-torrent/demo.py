from pathlib import Path
import socket, sys, threading

sys.path.append(str(Path(__file__).parent / "src"))
from mini_torrent import DHTNode, PeerWire, PiecePicker, benc, bitfield, compact, decode


BOOT = ("127.0.0.1", 6889)
NODE_A = "11" * 20
NODE_B = "22" * 20
INFO_HASH = b"01234567890123456789"
PEER_ID = b"-MT0001-demo-peer-01"


def fake_bootstrap():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(BOOT)
    for _ in range(2):
        data, addr = sock.recvfrom(2048)
        msg = decode(data)
        q = msg[b"q"]
        nodes = compact(NODE_A, "127.0.0.1", 51413) + compact(NODE_B, "127.0.0.1", 51414)
        reply = {b"t": msg[b"t"], b"y": b"r", b"r": {b"id": bytes.fromhex(NODE_A), b"nodes": nodes, b"token": b"demo"}}
        print(f"DHT server received {q.decode()} from {addr[0]}:{addr[1]}")
        sock.sendto(benc(reply), addr)
    sock.close()


threading.Thread(target=fake_bootstrap, daemon=True).start()
dht = DHTNode(BOOT, node_id=b"a" * 20)
nodes = dht.discover(INFO_HASH, target=b"z" * 20)
print("Discovered nodes:")
for node_id, ip, port in nodes:
    print(" ", node_id[:8], ip, port)

shake = PeerWire.handshake(INFO_HASH, PEER_ID)
parsed = PeerWire.parse_handshake(shake)
print("\nHandshake:")
print(" ", parsed["pstr"], parsed["info_hash"].decode(), parsed["peer_id"].decode())

frames = [
    PeerWire.msg(2),
    PeerWire.msg(5, bitfield([1, 1, 0, 1, 0, 0, 1, 0])),
    PeerWire.msg(6, (1).to_bytes(4, "big") + (0).to_bytes(4, "big") + (16384).to_bytes(4, "big")),
]
print("\nPeer wire frames:")
for frame in frames:
    print(" ", PeerWire.parse_msg(frame))

picker = PiecePicker(6)
for peer_bits in ([1, 0, 1, 0, 1, 0], [1, 1, 0, 0, 1, 0], [0, 1, 1, 1, 0, 0]):
    picker.observe(peer_bits)
print("\nRarest-first picks:", [picker.choose(), picker.choose(), picker.choose()])
