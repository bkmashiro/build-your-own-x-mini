from pathlib import Path
import sys

sys.path.append(str(Path(__file__).parent / "src"))
from mini_bitcoin import Blockchain


chain = Blockchain(difficulty=4)

for txs in (
    ["alice->bob:2", "coinbase->miner:50", "bob->carol:1"],
    ["carol->dave:1", "alice->erin:3"],
):
    block = chain.add_block(txs)
    print(f"block #{block.index}")
    print("  hash       :", block.hash)
    print("  prev_hash  :", block.prev_hash)
    print("  merkle_root:", block.merkle)
    print("  nonce      :", block.nonce)

print("\nchain valid:", chain.is_valid())
