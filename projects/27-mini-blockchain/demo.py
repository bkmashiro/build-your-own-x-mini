from pathlib import Path
import sys

sys.path.append(str(Path(__file__).parent / "src"))
from mini_blockchain import Blockchain


chain = Blockchain(difficulty=4, reward=25)
chain.add_transaction("alice", "bob", 15)
chain.add_transaction("bob", "carol", 10)
first = chain.mine_pending("miner-1")

chain.add_transaction("alice", "dave", 20)
chain.add_transaction("carol", "erin", 5)
second = chain.mine_pending("miner-2")

for block in (first, second):
    print(f"block #{block.index}")
    print("  hash      :", block.hash)
    print("  prev_hash :", block.prev_hash)
    print("  nonce     :", block.nonce)
    print("  txs       :", len(block.transactions))

print("\nbalances:", chain.balances())
print("chain valid:", chain.is_valid())

chain.chain[1].transactions[0]["amount"] = 999
print("after tamper:", chain.is_valid())
