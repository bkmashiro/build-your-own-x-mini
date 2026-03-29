# mini-riscv

> 一个极简 Python RV32I 模拟器，覆盖指令解码、ALU 执行和经典五级流水线。

[English](README.md)

---

## 功能

- 支持一组实用的 RV32I 指令：整数 ALU、`lw`/`sw`、分支、`jal`/`jalr`、`lui`、`auipc`
- 按周期模拟 `IF/ID/EX/MEM/WB` 五级流水寄存器
- 在 `EX` 阶段完成 ALU/分支决策，在 `MEM` 阶段访问内存，在 `WB` 阶段提交寄存器
- 分支或跳转命中时会 flush 掉更年轻的 `IF`/`ID` 指令

---

## 文件

- `src/mini_riscv.py`：不足 200 行的核心模拟器
- `demo.py`：运行一段手工编码的 RV32I 程序并打印流水线轨迹

---

## 运行方式

```bash
python projects/22-mini-riscv/demo.py
```

---

## 设计说明

这个实现刻意保持紧凑：

- `decode()` 从 32 位指令字中拆出 opcode、funct 字段、寄存器编号和立即数
- `alu()` 负责 RV32I 整数 ALU 指令，并保持 32 位回绕语义
- `cycle()` 推进一步流水线，把指令包依次流过 `IF`、`ID`、`EX`、`MEM`、`WB`
- 分支和跳转在 `EX` 阶段解析；若命中，就重定向 `pc` 并清空更年轻阶段

这样可以在不引入完整汇编器和冒险处理单元的前提下，看清楚解码、执行和流水线控制是怎样串起来的。

---

## 说明

- 这是教学用途实现，不是完整 ISA 模拟器。
- 没有 forwarding、stall、cache、异常处理或 CSR 支持。
- 演示程序故意插入 `nop`，让没有 hazard detector 的流水线仍然易于观察。
