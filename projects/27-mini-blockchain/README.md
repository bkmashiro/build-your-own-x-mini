# mini-blockchain

> A tiny blockchain in Python: blocks, SHA256 hashing, proof-of-work mining, simple account transactions, and full chain validation.

[中文](README.zh.md)

---

## Background

A blockchain needs a few core rules:

- every block hashes its own contents
- each block points to the previous block hash
- mining requires proof of work
- transactions cannot spend balances that do not exist

This project keeps those rules in one file. It uses a simple account model instead of Bitcoin's UTXO model so the validation logic stays readable.

---

## Architecture

```text
pending transactions
  -> block payload
  -> SHA256 hash
  -> nonce search for leading zeros
  -> append to chain
  -> replay transactions to verify balances
```

---

## Key Implementation

### `Block`

Each block stores:

- `index`
- `prev_hash`
- `transactions`
- `timestamp`
- `nonce`
- `difficulty`
- `hash`

`compute_hash()` serializes the block deterministically with `json.dumps(..., sort_keys=True)` and hashes it with SHA256.

### Proof of work

`Block.mine()` increments `nonce` until the block hash starts with `difficulty` leading zeroes.

### Simple transactions

Transactions are plain dictionaries:

```python
{"sender": "alice", "recipient": "bob", "amount": 15}
```

`Blockchain.add_transaction()` rejects malformed data, reserves `SYSTEM` for mining rewards, and checks the sender's spendable balance including pending transactions.

### Chain validation

`Blockchain.is_valid()` replays the whole chain and checks:

- stored block hash matches recomputed hash
- non-genesis blocks point to the previous hash
- proof-of-work target is satisfied
- transaction shapes are valid
- no account goes negative
- each mined block has exactly one reward transaction

---

## How to Run

```bash
python projects/27-mini-blockchain/demo.py
```

The demo mines two blocks, prints the resulting hashes and balances, then tampers with a transaction to show validation failing.

---

## What This Omits

- networking and peer discovery
- digital signatures
- UTXO sets and scripts
- dynamic difficulty adjustment
- forks and consensus between nodes

The goal is the block lifecycle: create transactions, mine blocks, link hashes, and verify the chain by replaying state.
