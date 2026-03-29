"""mini-bitcoin - tiny blockchain with SHA256, Merkle roots, and PoW."""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass, field


def sha256(data: str) -> str:
    return hashlib.sha256(data.encode()).hexdigest()


def merkle_root(items: list[str]) -> str:
    layer = [sha256(item) for item in items] or [sha256("")]
    while len(layer) > 1:
        if len(layer) % 2:
            layer.append(layer[-1])
        layer = [sha256(layer[i] + layer[i + 1]) for i in range(0, len(layer), 2)]
    return layer[0]


@dataclass
class Block:
    index: int
    prev_hash: str
    transactions: list[str]
    difficulty: int = 4
    timestamp: float = field(default_factory=lambda: round(time.time(), 3))
    nonce: int = 0
    merkle: str = ""
    hash: str = ""

    def __post_init__(self) -> None:
        self.merkle = self.merkle or merkle_root(self.transactions)
        self.hash = self.hash or self.compute_hash()

    def payload(self) -> str:
        return json.dumps(
            {
                "index": self.index,
                "prev_hash": self.prev_hash,
                "timestamp": self.timestamp,
                "transactions": self.transactions,
                "nonce": self.nonce,
                "difficulty": self.difficulty,
                "merkle": self.merkle,
            },
            sort_keys=True,
            separators=(",", ":"),
        )

    def compute_hash(self) -> str:
        return sha256(self.payload())

    def mine(self) -> None:
        target = "0" * self.difficulty
        while not self.hash.startswith(target):
            self.nonce += 1
            self.hash = self.compute_hash()


class Blockchain:
    def __init__(self, difficulty: int = 4) -> None:
        self.difficulty = difficulty
        self.chain = [self._genesis()]

    def _genesis(self) -> Block:
        block = Block(0, "0" * 64, ["genesis"], self.difficulty)
        block.mine()
        return block

    @property
    def tip(self) -> Block:
        return self.chain[-1]

    def add_block(self, transactions: list[str]) -> Block:
        block = Block(len(self.chain), self.tip.hash, transactions, self.difficulty)
        block.mine()
        self.chain.append(block)
        return block

    def is_valid(self) -> bool:
        for i, block in enumerate(self.chain):
            if block.merkle != merkle_root(block.transactions):
                return False
            if block.compute_hash() != block.hash:
                return False
            if not block.hash.startswith("0" * block.difficulty):
                return False
            if i == 0:
                if block.prev_hash != "0" * 64:
                    return False
                continue
            prev = self.chain[i - 1]
            if block.prev_hash != prev.hash or block.index != prev.index + 1:
                return False
        return True
