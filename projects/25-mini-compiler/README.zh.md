# mini-compiler

> 纯 Python 实现的极小编译器：词法分析、递归下降语法分析、AST 和栈机代码生成。

[English](README.md)

---

## 背景

把语言缩小以后，编译器主流程会变得非常直观：

- 先把源码切成 token
- 再按优先级把 token 解析成语法树
- 用 AST 显式表示语义结构
- 最后从语法树生成目标指令

这个项目支持基本算术表达式、括号、一元 `+` / `-`、变量和赋值语句。目标代码是一套极小的栈机指令，因此代码生成阶段很容易看清楚。

---

## 架构

```text
源码
  -> 词法分析成 NUMBER / IDENT / 运算符
  -> 解析成 Program / Assign / BinaryOp / UnaryOp 节点
  -> 生成栈式指令
  -> 可选地交给一个极小 VM 执行
```

---

## 语法

```text
program    := statement*
statement  := IDENT "=" expression | expression
expression := term (("+" | "-") term)*
term       := factor (("*" | "/") factor)*
factor     := NUMBER | IDENT | "(" expression ")" | ("+" | "-") factor
```

这里使用递归下降解析，因此运算符优先级直接体现在 `expression -> term -> factor` 这层结构里。

---

## 代码生成

编译器会输出这样的栈机指令：

```text
PUSH 2
PUSH 3
PUSH 4
MUL
ADD
STORE x
```

这样 AST 到执行顺序的映射会非常清楚：

- 叶子节点先把值压栈
- 二元运算先生成左子树，再生成右子树
- 赋值语句把栈顶结果写回变量环境

---

## 运行方式

```bash
python projects/25-mini-compiler/demo.py
```

demo 会打印 token、AST、生成出的栈机代码，以及最终执行结果。

---

## 这里省略了什么

- 函数调用
- 字符串和布尔值
- 控制流
- SSA / 寄存器分配
- 机器码生成

这些属于更完整的编译器主题，但理解 lexer-parser-AST-codegen 主链路并不需要它们。
