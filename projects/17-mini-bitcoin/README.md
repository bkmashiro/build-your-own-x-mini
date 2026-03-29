# mini-bitcoin

> A tiny Bitcoin-style blockchain in Python: SHA256 hashing, Merkle roots, proof-of-work mining, and full chain validation.

[中文](README.zh.md)

---

## Background

Bitcoin blocks do three core things:

- hash transactions into a Merkle root
- link each block to the previous hash
- require proof-of-work before a block is accepted

This project compresses those ideas into one small file. It is not a real cryptocurrency. It is just enough to make the data flow and validation rules visible.

---

## Architecture

```text
transactions
  -> SHA256 leaves
  -> Merkle tree
  -> block header
  -> nonce search
  -> block hash with leading zeros
  -> append to chain
  -> full-chain validation
```

---

## Key Implementation

### SHA256

`sha256()` is a thin wrapper over `hashlib.sha256()`. Every transaction leaf, Merkle parent, and block header hash goes through the same primitive.

### Merkle tree

`merkle_root()` hashes every transaction, then repeatedly hashes adjacent pairs until one root remains. If a layer has an odd count, the last hash is duplicated, matching the common Bitcoin-style approach.

### Proof of work

Each block includes:

- index
- previous block hash
- timestamp
- transactions
- nonce
- difficulty
- Merkle root

Mining increments the nonce until the block hash starts with `difficulty` leading zeroes.

### Chain validation

`Blockchain.is_valid()` checks:

- every block recomputes to the stored hash
- every Merkle root matches its transactions
- every block satisfies the PoW target
- every `prev_hash` points to the previous block
- block indexes are continuous

---

## How to Run

```bash
python projects/17-mini-bitcoin/demo.py
```

The demo mines two blocks, prints each block hash and Merkle root, then validates the whole chain.

---

## What This Omits

- networking and peer discovery
- real transaction formats and signatures
- UTXO accounting
- difficulty retargeting
- forks and longest-chain selection

Those are major systems. The goal here is the block structure and validation pipeline.
