# mini-torrent

> A tiny BitTorrent-style core in Python: Kademlia DHT node discovery, peer wire protocol framing, and rarest-first piece selection.

[中文](README.zh.md)

---

## Background

A real BitTorrent client has three different jobs:

- find peers through the DHT
- speak the peer wire protocol after connecting
- decide which piece to download next

This project compresses those ideas into one small file. It is not a full torrent client. It is just enough to show discovery, handshake framing, and rarest-first scheduling.

---

## Architecture

```text
bootstrap node
  -> UDP DHT query (find_node / get_peers)
  -> compact node list
  -> peer handshake
  -> peer wire messages
  -> piece availability tracking
  -> rarest-first picker
```

---

## Key Implementation

### DHT discovery

`DHTNode` sends Kademlia-style UDP queries to a bootstrap node. The implementation builds bencoded `find_node` and `get_peers` messages, matches transaction IDs, and parses compact 26-byte node records into `(node_id, ip, port)` tuples.

### Peer wire protocol

`PeerWire.handshake()` builds the standard BitTorrent handshake:

- `pstrlen`
- `pstr`
- `reserved`
- `info_hash`
- `peer_id`

The helper also packs and parses common peer wire frames like `interested`, `bitfield`, and `request`.

### Piece selection

`PiecePicker` tracks how many peers advertise each piece. `choose()` only considers missing pieces and returns the piece with the smallest availability count, which is the classic rarest-first strategy.

---

## How to Run

```bash
python projects/18-mini-torrent/demo.py
```

The demo starts a local fake DHT bootstrap node, sends real UDP `find_node` and `get_peers` requests, prints discovered nodes, simulates a BitTorrent handshake, and shows rarest-first piece picks.

---

## What This Omits

- TCP peer connections and real downloads
- full bencode validation and error handling
- routing tables, tokens, announces, and seeding loops
- choke/unchoke state machines and endgame mode

Those are larger systems. The goal here is to make the discovery and wire-format flow visible.
