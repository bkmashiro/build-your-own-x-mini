"""mini-blockchain - tiny blockchain with PoW, balances, and validation."""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass, field


def sha256(data: str) -> str:
    return hashlib.sha256(data.encode()).hexdigest()


@dataclass
class Block:
    index: int
    prev_hash: str
    transactions: list[dict]
    difficulty: int = 4
    timestamp: float = field(default_factory=lambda: round(time.time(), 3))
    nonce: int = 0
    hash: str = ""

    def __post_init__(self) -> None:
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
    def __init__(self, difficulty: int = 4, reward: int = 25) -> None:
        self.difficulty = difficulty
        self.reward = reward
        self.pending: list[dict] = []
        self.chain = [self._genesis()]

    def _genesis(self) -> Block:
        return Block(
            0,
            "0" * 64,
            [
                {"sender": "SYSTEM", "recipient": "alice", "amount": 100},
                {"sender": "SYSTEM", "recipient": "bob", "amount": 60},
            ],
            self.difficulty,
        )

    @property
    def tip(self) -> Block:
        return self.chain[-1]

    def balance_of(self, account: str) -> int:
        balances = self._balances(self.chain)
        for tx in self.pending:
            if tx["sender"] != "SYSTEM":
                balances[tx["sender"]] = balances.get(tx["sender"], 0) - tx["amount"]
            balances[tx["recipient"]] = balances.get(tx["recipient"], 0) + tx["amount"]
        return balances.get(account, 0)

    def add_transaction(self, sender: str, recipient: str, amount: int) -> None:
        tx = {"sender": sender, "recipient": recipient, "amount": amount}
        self._validate_transaction(tx)
        if sender == "SYSTEM":
            raise ValueError("SYSTEM transactions are reserved for mining rewards")
        if self.balance_of(sender) < amount:
            raise ValueError("insufficient funds")
        self.pending.append(tx)

    def mine_pending(self, miner: str) -> Block:
        txs = self.pending + [
            {"sender": "SYSTEM", "recipient": miner, "amount": self.reward}
        ]
        block = Block(len(self.chain), self.tip.hash, txs, self.difficulty)
        block.mine()
        self.chain.append(block)
        self.pending = []
        return block

    def balances(self) -> dict[str, int]:
        return self._balances(self.chain)

    def is_valid(self) -> bool:
        target = "0" * self.difficulty
        balances: dict[str, int] = {}
        for i, block in enumerate(self.chain):
            if block.hash != block.compute_hash():
                return False
            if i == 0:
                if block.prev_hash != "0" * 64:
                    return False
            else:
                prev = self.chain[i - 1]
                if block.index != prev.index + 1 or block.prev_hash != prev.hash:
                    return False
                if not block.hash.startswith(target):
                    return False
            rewards = 0
            for tx in block.transactions:
                if not self._valid_shape(tx):
                    return False
                if tx["sender"] == "SYSTEM":
                    rewards += 1
                    if i > 0 and tx["amount"] != self.reward:
                        return False
                else:
                    balances[tx["sender"]] = balances.get(tx["sender"], 0) - tx["amount"]
                    if balances[tx["sender"]] < 0:
                        return False
                balances[tx["recipient"]] = balances.get(tx["recipient"], 0) + tx["amount"]
            if i > 0 and rewards != 1:
                return False
        return True

    def _balances(self, chain: list[Block]) -> dict[str, int]:
        balances: dict[str, int] = {}
        for block in chain:
            for tx in block.transactions:
                if tx["sender"] != "SYSTEM":
                    balances[tx["sender"]] = balances.get(tx["sender"], 0) - tx["amount"]
                balances[tx["recipient"]] = balances.get(tx["recipient"], 0) + tx["amount"]
        return balances

    def _validate_transaction(self, tx: dict) -> None:
        if not self._valid_shape(tx):
            raise ValueError("transaction must have sender, recipient, positive amount")

    def _valid_shape(self, tx: dict) -> bool:
        return (
            isinstance(tx.get("sender"), str)
            and isinstance(tx.get("recipient"), str)
            and tx["sender"]
            and tx["recipient"]
            and isinstance(tx.get("amount"), int)
            and tx["amount"] > 0
        )
