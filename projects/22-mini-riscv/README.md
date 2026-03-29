# mini-riscv

> A tiny Python RV32I simulator covering instruction decode, ALU execution, and a classic five-stage pipeline.

[中文](README.zh.md)

---

## Features

- Decodes a practical subset of RV32I: integer ALU ops, `lw`/`sw`, branches, `jal`/`jalr`, `lui`, `auipc`
- Simulates `IF/ID/EX/MEM/WB` pipeline registers cycle by cycle
- Models ALU work in `EX`, memory traffic in `MEM`, and register commits in `WB`
- Flushes `IF`/`ID` when a branch or jump resolves as taken

---

## Files

- `src/mini_riscv.py`: core simulator in under 200 lines
- `demo.py`: runs a short hand-encoded RV32I program and prints pipeline traces

---

## How to Run

```bash
python projects/22-mini-riscv/demo.py
```

---

## Design

The implementation stays intentionally small:

- `decode()` extracts opcode, funct fields, register ids, and immediates from a 32-bit instruction word
- `alu()` handles the integer RV32I ALU family with 32-bit wraparound
- `cycle()` advances one pipeline tick, moving packets through `IF`, `ID`, `EX`, `MEM`, and `WB`
- Branches and jumps resolve in `EX`; when taken, the simulator redirects `pc` and flushes younger stages

This keeps the control flow visible enough to study decode and pipeline behavior without building a full assembler or hazard unit.

---

## Notes

- This is a teaching model, not a full ISA simulator.
- There is no forwarding, stalling, cache, exception handling, or CSR support.
- The demo inserts `nop`s so the pipeline stays readable without a hazard detector.
