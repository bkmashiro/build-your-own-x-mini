# mini-shell

> 用约 190 行 Python 实现的 POSIX 风格交互式 Shell。  
> 词法分析 → AST → fork/exec，支持管道、重定向和内置命令。

[English](README.md)

---

## 背景

你每天使用的每个 Unix Shell（bash、zsh）本质上都在做相同的五件事：

1. **读取**用户输入的一行
2. **词法分析**（处理引号、转义、变量展开）
3. **语法解析**，将 token 转换为命令和管道结构
4. **fork** 子进程并用管道连接
5. **等待**子进程结束并报告退出码

真实的 Shell 在此基础上叠加了作业控制、算术运算、函数等数千个边界情况，但核心循环就是这五步。理解了这五步，你就理解了 Shell 的本质。

---

## 架构

```
REPL（输入循环）
    │
    ▼
词法分析器（Tokenizer）   "echo $HOME | grep usr"
    │                      → ['echo', '/home/alice', '|', 'grep', 'usr']
    ▼
解析器（Parser / AST）    pipelines → [Cmd, Cmd]
    │                      每个 Cmd：argv、stdin_file、stdout_file、append
    ▼
exec_pipeline()
    ├── os.pipe()          — 创建 n-1 个匿名管道
    ├── os.fork()          — 每个 Cmd fork 一个子进程
    │       ├── 子进程：dup2 管道 fd，应用重定向，execvpe()
    │       └── 父进程：收集 pid 列表
    └── os.waitpid() × n  — 回收子进程，返回最后一个退出码
```

内置命令（`cd`、`export`、`echo`）**必须在父进程中执行**，因为它们会修改当前工作目录、环境变量等进程状态——这些状态在 fork+exec 后无法传递回父进程。

---

## 关键实现解析

### 词法分析器

词法分析器是对输入字符串的单趟状态机遍历。

```python
if ch == "'":           # 单引号：所有内容字面量处理
    ...
if ch == '"':           # 双引号：只展开 $VAR
    ...
if ch == '$':           # 裸变量：$HOME 或 ${HOME}
    ...
if ch in SPECIAL:       # |、<、>、>>、;、& 各自作为独立 token
    ...
```

`>>` 的处理方式是在发出 `>` 之前向前多看一个字符。

### 管道：os.pipe() + os.fork() 的配合

```
cmd0  ──写──► pipe[0] ──读──► cmd1  ──写──► pipe[1] ──读──► cmd2
```

对于 *n* 个命令，我们在 fork 之前创建 *n−1* 个管道。每个子进程：
- 将**上一个管道的读端** dup2 到 fd 0（stdin）
- 将**下一个管道的写端** dup2 到 fd 1（stdout）
- 然后关闭**所有**管道 fd，确保写端全部关闭时读端能收到 EOF

父进程也要关闭所有管道 fd——这一步至关重要，否则读端的子进程会永远阻塞，等待一个永远不会关闭的写端。

### 重定向

在 fork 之后、exec 之前应用于子进程：

```python
fd = os.open(file, os.O_RDONLY)
os.dup2(fd, 0)   # 替换 stdin
os.close(fd)
```

`>>` 使用 `os.O_APPEND` 而非 `os.O_TRUNC`。

### 变量展开

在词法分析阶段处理，而不是在解析时处理：

```python
if ch == '$':
    var_name = read_identifier(line, i)
    current.append(os.environ.get(var_name, ''))
```

双引号字符串允许 `$VAR` 展开，单引号字符串禁止所有展开。

---

## 运行方式

```bash
# 交互式 REPL
python3 src/mini_shell.py

# 自动化演示（不需要 TTY）
python3 demo.py
```

示例会话：

```
~/projects $ echo "hello world"
hello world
~/projects $ ls src | grep py
mini_shell.py
~/projects $ export GREETING=hi
~/projects $ echo $GREETING there
hi there
~/projects $ echo done > /tmp/out.txt; cat /tmp/out.txt
done
~/projects $ exit
```

---

## 核心要点

| 概念 | mini-shell 中的实现方式 |
|:-----|:----------------------|
| **词法分析** | 单趟状态机，处理引号、转义、`$VAR` |
| **管道** | `os.pipe()` × (n−1)，每个子进程中 `os.dup2()` |
| **重定向** | fork 后、exec 前用 `os.open()` + `os.dup2()` |
| **内置命令** | 在父进程中运行；不能 fork（它们会修改进程状态） |
| **变量展开** | 词法分析时单趟完成，遵守引号规则 |
| **分号** | 将 token 流拆分为独立的 pipeline，顺序执行 |
| **EOF 传播** | 父进程必须关闭所有管道 fd，否则读端永远阻塞 |

构建真实 Shell 最难的部分不是解析——而是把 pipe/fork/dup2 的时序写对，让 EOF 能在多级管道中正确传播。

这也是为什么即使在 2026 年，依然值得从零实现一个 Shell：它让你对"进程间通信"从抽象概念变成具体的系统调用序列。
