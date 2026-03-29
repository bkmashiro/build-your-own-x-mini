from pathlib import Path
import sys

ROOT = Path(__file__).parent
sys.path.append(str(ROOT / "src"))

from mini_riscv import MiniRISCV


def r(f7, rs2, rs1, f3, rd, op=0x33):
    return (f7 << 25) | (rs2 << 20) | (rs1 << 15) | (f3 << 12) | (rd << 7) | op


def i(imm, rs1, f3, rd, op=0x13):
    return ((imm & 0xFFF) << 20) | (rs1 << 15) | (f3 << 12) | (rd << 7) | op


def s(imm, rs2, rs1, f3, op=0x23):
    return (((imm >> 5) & 0x7F) << 25) | (rs2 << 20) | (rs1 << 15) | (f3 << 12) | ((imm & 0x1F) << 7) | op


def b(imm, rs2, rs1, f3, op=0x63):
    imm &= 0x1FFF
    return (((imm >> 12) & 1) << 31) | (((imm >> 5) & 0x3F) << 25) | (rs2 << 20) | (rs1 << 15) | (f3 << 12) | (((imm >> 1) & 0xF) << 8) | (((imm >> 11) & 1) << 7) | op


def j(imm, rd, op=0x6F):
    imm &= 0x1FFFFF
    return (((imm >> 20) & 1) << 31) | (((imm >> 12) & 0xFF) << 12) | (((imm >> 11) & 1) << 20) | (((imm >> 1) & 0x3FF) << 21) | (rd << 7) | op


program = [
    i(5, 0, 0, 1),          # addi x1, x0, 5
    0x00000013,             # nop
    i(7, 0, 0, 2),          # addi x2, x0, 7
    0x00000013,             # nop
    r(0, 2, 1, 0, 3),       # add  x3, x1, x2
    s(0, 3, 0, 2),          # sw   x3, 0(x0)
    i(0, 0, 2, 4, 0x03),    # lw   x4, 0(x0)
    0x00000013,             # nop
    b(8, 4, 3, 0),          # beq  x3, x4, +8
    i(99, 0, 0, 5),         # addi x5, x0, 99 (flushed)
    j(8, 6),                # jal  x6, +8
    i(1, 0, 0, 7),          # addi x7, x0, 1 (skipped)
    i(42, 0, 0, 8),         # addi x8, x0, 42
]

cpu = MiniRISCV(program)
for step in cpu.run():
    print(f"\n{step['log'][0]}")
    for line in step["log"][1:]:
        print(line)
    print(" ", step["pipeline"])

print("\n== Snapshot ==")
print(cpu.snapshot())
