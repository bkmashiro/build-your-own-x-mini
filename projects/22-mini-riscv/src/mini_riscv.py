"""mini-riscv - decode RV32I and simulate a five-stage pipeline in under 200 lines."""

from __future__ import annotations


def bits(x, lo, hi):
    return (x >> lo) & ((1 << (hi - lo + 1)) - 1)


def sext(x, n):
    sign = 1 << (n - 1)
    return (x & (sign - 1)) - (x & sign)


def imm_i(w):
    return sext(bits(w, 20, 31), 12)


def imm_s(w):
    return sext(bits(w, 7, 11) | (bits(w, 25, 31) << 5), 12)


def imm_b(w):
    raw = (bits(w, 8, 11) << 1) | (bits(w, 25, 30) << 5) | (bits(w, 7, 7) << 11) | (bits(w, 31, 31) << 12)
    return sext(raw, 13)


def imm_u(w):
    return w & 0xFFFFF000


def imm_j(w):
    raw = (bits(w, 21, 30) << 1) | (bits(w, 20, 20) << 11) | (bits(w, 12, 19) << 12) | (bits(w, 31, 31) << 20)
    return sext(raw, 21)


class MiniRISCV:
    def __init__(self, program):
        self.prog = list(program)
        self.reg = [0] * 32
        self.mem = {}
        self.pc = 0
        self.cycle_no = 0
        self.halted = False
        self.pipe = {name: None for name in ("IF", "ID", "EX", "MEM", "WB")}

    def decode(self, word, pc):
        op, f3, f7 = bits(word, 0, 6), bits(word, 12, 14), bits(word, 25, 31)
        rd, rs1, rs2 = bits(word, 7, 11), bits(word, 15, 19), bits(word, 20, 24)
        if word == 0x00000013:
            return {"name": "nop", "fmt": "I", "rd": 0, "rs1": 0, "rs2": 0, "imm": 0, "pc": pc}
        if op == 0x33:
            names = {(0, 0x00): "add", (0, 0x20): "sub", (7, 0): "and", (6, 0): "or", (4, 0): "xor",
                     (1, 0): "sll", (5, 0): "srl", (5, 0x20): "sra", (2, 0): "slt", (3, 0): "sltu"}
            name = names[(f3, f7)]
            return {"name": name, "fmt": "R", "rd": rd, "rs1": rs1, "rs2": rs2, "pc": pc}
        if op == 0x13:
            names = {0: "addi", 7: "andi", 6: "ori", 4: "xori", 2: "slti", 3: "sltiu"}
            name = {1: "slli", 5: "srai" if f7 == 0x20 else "srli"}.get(f3, names[f3])
            return {"name": name, "fmt": "I", "rd": rd, "rs1": rs1, "rs2": 0, "imm": imm_i(word), "pc": pc}
        if op == 0x03:
            return {"name": {2: "lw"}[f3], "fmt": "I", "rd": rd, "rs1": rs1, "rs2": 0, "imm": imm_i(word), "pc": pc}
        if op == 0x23:
            return {"name": {2: "sw"}[f3], "fmt": "S", "rd": 0, "rs1": rs1, "rs2": rs2, "imm": imm_s(word), "pc": pc}
        if op == 0x63:
            return {"name": {0: "beq", 1: "bne", 4: "blt", 5: "bge"}[f3], "fmt": "B", "rd": 0, "rs1": rs1, "rs2": rs2, "imm": imm_b(word), "pc": pc}
        if op == 0x6F:
            return {"name": "jal", "fmt": "J", "rd": rd, "rs1": 0, "rs2": 0, "imm": imm_j(word), "pc": pc}
        if op == 0x67:
            return {"name": "jalr", "fmt": "I", "rd": rd, "rs1": rs1, "rs2": 0, "imm": imm_i(word), "pc": pc}
        if op == 0x37:
            return {"name": "lui", "fmt": "U", "rd": rd, "rs1": 0, "rs2": 0, "imm": imm_u(word), "pc": pc}
        if op == 0x17:
            return {"name": "auipc", "fmt": "U", "rd": rd, "rs1": 0, "rs2": 0, "imm": imm_u(word), "pc": pc}
        raise ValueError(f"unsupported instruction 0x{word:08x}")

    def alu(self, name, a, b):
        ops = {
            "add": a + b, "addi": a + b, "sub": a - b, "and": a & b, "andi": a & b, "or": a | b, "ori": a | b,
            "xor": a ^ b, "xori": a ^ b, "sll": (a << (b & 31)), "slli": (a << (b & 31)),
            "srl": (a & 0xFFFFFFFF) >> (b & 31), "srli": (a & 0xFFFFFFFF) >> (b & 31),
            "sra": sext(a & 0xFFFFFFFF, 32) >> (b & 31), "srai": sext(a & 0xFFFFFFFF, 32) >> (b & 31),
            "slt": int(sext(a & 0xFFFFFFFF, 32) < sext(b & 0xFFFFFFFF, 32)),
            "slti": int(sext(a & 0xFFFFFFFF, 32) < b), "sltu": int((a & 0xFFFFFFFF) < (b & 0xFFFFFFFF)),
            "sltiu": int((a & 0xFFFFFFFF) < (b & 0xFFFFFFFF)),
        }
        return ops[name] & 0xFFFFFFFF

    def _read(self, idx, *stages):
        if idx == 0:
            return 0
        for st in stages:
            if st and st.get("rd") == idx and "value" in st:
                return st["value"] & 0xFFFFFFFF
        return self.reg[idx]

    def _fetch(self):
        i = self.pc // 4
        if i >= len(self.prog):
            self.halted = True
            return None
        pkt = {"pc": self.pc, "word": self.prog[i], "asm": f"0x{self.prog[i]:08x}"}
        self.pc += 4
        return pkt

    def cycle(self):
        self.cycle_no += 1
        cur, nxt, flush = self.pipe.copy(), {k: None for k in self.pipe}, False
        log = [f"cycle {self.cycle_no}"]
        wb = cur["WB"]
        if wb and wb.get("rd"):
            self.reg[wb["rd"]] = wb["value"] & 0xFFFFFFFF
            self.reg[0] = 0
            log.append(f"  WB : x{wb['rd']} <- {wb['value'] & 0xFFFFFFFF}")
        mem = cur["MEM"]
        if mem:
            if mem["name"] == "lw":
                mem["value"] = self.mem.get(mem["addr"], 0)
                log.append(f"  MEM: load  mem[{mem['addr']}] -> {mem['value']}")
            elif mem["name"] == "sw":
                self.mem[mem["addr"]] = mem["store"] & 0xFFFFFFFF
                log.append(f"  MEM: store mem[{mem['addr']}] <- {mem['store'] & 0xFFFFFFFF}")
            nxt["WB"] = mem if mem.get("rd") else None
        ex = cur["EX"]
        if ex:
            a, b, imm, name = ex["a"], ex["b"], ex.get("imm", 0), ex["name"]
            if name in {"lw", "sw"}:
                ex["addr"] = (a + imm) & 0xFFFFFFFF
            elif name in {"beq", "bne", "blt", "bge"}:
                taken = {"beq": a == b, "bne": a != b, "blt": sext(a, 32) < sext(b, 32), "bge": sext(a, 32) >= sext(b, 32)}[name]
                if taken:
                    self.pc = ex["pc"] + imm
                    flush = True
                log.append(f"  EX : {name} taken={taken}")
            elif name == "jal":
                ex["value"], self.pc, flush = ex["pc"] + 4, ex["pc"] + imm, True
            elif name == "jalr":
                ex["value"], self.pc, flush = ex["pc"] + 4, (a + imm) & ~1, True
            elif name == "lui":
                ex["value"] = imm
            elif name == "auipc":
                ex["value"] = ex["pc"] + imm
            elif name != "nop":
                ex["value"] = self.alu(name, a, imm if name.endswith("i") else b)
            if name not in {"beq", "bne", "blt", "bge"}:
                log.append(f"  EX : {name}")
            nxt["MEM"] = ex if name != "nop" else None
        ide = cur["ID"]
        if ide and not flush:
            ins = self.decode(ide["word"], ide["pc"])
            ins["a"] = self._read(ins["rs1"], ex, mem)
            ins["b"] = self._read(ins["rs2"], ex, mem)
            ins["asm"] = ide["asm"]
            if ins["name"] == "sw":
                ins["store"] = ins["b"]
            nxt["EX"] = ins
            log.append(f"  ID : {ins['name']}")
        iff = cur["IF"]
        if iff and not flush:
            nxt["ID"] = iff
            log.append(f"  IF : {iff['asm']}")
        fetched = None if flush or self.halted else self._fetch()
        nxt["IF"] = fetched
        if flush:
            log.append(f"  PC : redirect -> {self.pc}")
        self.pipe = nxt
        active = any(self.pipe.values()) or (self.pc // 4) < len(self.prog)
        return {"cycle": self.cycle_no, "pipeline": {k: (v["asm"] if v else ".") for k, v in self.pipe.items()}, "log": log, "active": active}

    def run(self, max_cycles=50):
        trace = []
        while len(trace) < max_cycles:
            step = self.cycle()
            trace.append(step)
            if not step["active"]:
                break
        return trace

    def snapshot(self):
        return {
            "pc": self.pc,
            "registers": {f"x{i}": v for i, v in enumerate(self.reg) if v},
            "memory": dict(sorted(self.mem.items())),
        }
