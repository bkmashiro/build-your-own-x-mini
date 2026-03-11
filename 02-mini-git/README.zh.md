# 02 — mini-git 最小 Git 实现

[English](README.md)

> 用纯 Python 实现 Git 核心对象模型，~190 行代码，与真实 `.git` 目录完全兼容。

---

## 背景与动机

Git 是每个开发者每天都在用的工具，但"Git 内部是怎么工作的"对大多数人来说还是一个黑盒。`git commit` 到底存了什么？为什么相同内容的文件不会被重复存储？`checkout` 怎么恢复文件？

这个项目的目标是：**用最少的代码实现 Git 的核心 plumbing 命令**，揭示 Git 最本质的设计——内容寻址对象存储（content-addressable storage）。

关键约束：**生成的 `.git` 目录与真实 Git 完全兼容**。用 mini-git 创建的仓库，可以用真实的 `git log` 查看，用 `git cat-file` 检查对象。

---

## 核心架构

Git 的存储层建立在一个极其简单的原则上：

> **每个对象由其内容的 SHA1 哈希唯一标识，存储在 `.git/objects/` 下。**

这就是"内容寻址存储"（content-addressable storage，CAS）。它带来了几个重要性质：
- 相同内容的文件，哈希相同，只存一份（自动去重）
- 哈希本身就是完整性校验，内容被篡改则哈希不匹配
- 对象一旦写入就是不可变的

整个系统只有三种对象类型：

```
blob    ←  文件内容
tree    ←  目录快照（指向 blob 和子 tree）
commit  ←  历史节点（指向 tree + 父 commit）
```

对象之间形成有向无环图（DAG）：

```
commit ──→ tree ──→ blob (README.md)
  │          └──→ blob (main.py)
  │          └──→ tree (src/) ──→ blob (utils.py)
  └──→ parent commit ──→ ...
```

---

## 关键实现

### 对象存储格式

所有对象都使用相同的格式：`<type> <size>\0<content>`，然后用 zlib 压缩，存储路径由 SHA1 决定：

```
.git/objects/a1/b2c3d4e5f6...  ← 前两位作为目录名，剩余作为文件名
```

这个两级目录结构是为了避免单个目录下文件过多（文件系统在目录条目过多时性能会下降）。

```python
def object_path(sha: str) -> str:
    return os.path.join(".git", "objects", sha[:2], sha[2:])

def hash_object(data: bytes, obj_type: str = "blob", write: bool = False) -> str:
    """计算 git 对象的 SHA1：'<type> <size>\0<content>'"""
    header = f"{obj_type} {len(data)}\0".encode()
    full = header + data
    sha = hashlib.sha1(full).hexdigest()
    if write:
        path = object_path(sha)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if not os.path.exists(path):  # 内容寻址：相同内容无需重写
            with open(path, "wb") as f:
                f.write(zlib.compress(full))
    return sha

def read_object(sha: str) -> tuple[str, bytes]:
    """读取并解压 git 对象，返回 (type, content)"""
    path = object_path(sha)
    with open(path, "rb") as f:
        raw = zlib.decompress(f.read())
    null_idx = raw.index(b"\0")
    header = raw[:null_idx].decode()
    obj_type = header.split(" ", 1)[0]
    content = raw[null_idx + 1:]
    return obj_type, content
```

这里有一个细节：`if not os.path.exists(path)` 避免了重复写入——因为相同内容哈希必然相同，路径也相同，写入一次就够了。

### Blob：纯文件内容

Blob 是最简单的对象，就是文件的原始字节内容，**不包含文件名或权限信息**。文件名由上层的 tree 对象管理。

```python
def cmd_hash_object(args):
    write = "-w" in args
    filepath = [a for a in args if a != "-w"][0]
    with open(filepath, "rb") as f:
        data = f.read()
    sha = hash_object(data, "blob", write=write)
    print(sha)
```

运行后可以用真实 `git cat-file` 验证：
```bash
python mini_git.py hash-object -w README.md
# 输出：e69de29bb2d1d6434b8b29ae775ad8c2e48c5391
git cat-file -p e69de29bb2d1d6434b8b29ae775ad8c2e48c5391
# 直接输出文件内容 ✓
```

### Tree：目录快照

Tree 对象记录一个目录的快照——每个条目是 `(mode, name, sha1)` 的三元组。格式是二进制紧凑编码：

```
<mode> <name>\0<20字节二进制SHA1><mode> <name>\0<20字节二进制SHA1>...
```

注意 SHA1 以 **20 字节二进制**存储，而不是 40 字节十六进制字符串，节省一半空间。

```python
def cmd_write_tree(path="."):
    """递归从工作目录创建 tree 对象"""
    entries = []
    for name in sorted(os.listdir(path)):  # 按名称排序，保证确定性
        if name == ".git":
            continue
        full = os.path.join(path, name)
        if os.path.isfile(full):
            with open(full, "rb") as f:
                data = f.read()
            sha = hash_object(data, "blob", write=True)
            mode = "100755" if os.access(full, os.X_OK) else "100644"
            entries.append((mode, name, sha))
        elif os.path.isdir(full):
            sha = cmd_write_tree(full)  # 递归处理子目录
            entries.append(("40000", name, sha))
    # 拼接 tree 数据：mode + 空格 + name + \0 + 20字节SHA1
    tree_data = b""
    for mode, name, sha in entries:
        tree_data += f"{mode} {name}\0".encode() + bytes.fromhex(sha)
    sha = hash_object(tree_data, "tree", write=True)
    if path == ".":
        print(sha)
    return sha
```

目录条目按名称排序是为了保证确定性：相同的目录内容，不管列出顺序如何，最终产生相同的 tree 哈希。

Tree 的读取（用于 `cat-file` 和 `checkout`）需要反向解析这个二进制格式：

```python
# Tree 解析：按字节手动扫描
i = 0
while i < len(content):
    space = content.index(b" ", i)
    mode = content[i:space].decode()
    null = content.index(b"\0", space)
    name = content[space + 1:null].decode()
    entry_sha = content[null + 1:null + 21].hex()  # 20字节 → 40字符十六进制
    i = null + 21
```

### Commit：历史链

Commit 对象用纯文本格式存储：

```
tree <tree-sha>\n
parent <parent-sha>\n          ← 可选（初始提交没有 parent）
author Name <email> timestamp tz\n
committer Name <email> timestamp tz\n
\n
<提交消息>\n
```

```python
def cmd_commit_tree(args):
    tree_sha = args[0]
    # 自动从 HEAD 获取父提交（如果未指定 -p）
    if parent is None:
        parent = get_head_commit()
    timestamp = int(time.time())
    author = f"Mini Git <mini@git> {timestamp} +0000"
    lines = [f"tree {tree_sha}"]
    if parent:
        lines.append(f"parent {parent}")
    lines += [f"author {author}", f"committer {author}", "", message, ""]
    content = "\n".join(lines).encode()
    sha = hash_object(content, "commit", write=True)
    update_head(sha)  # 更新 HEAD 指向新提交
    print(sha)
```

Commit 链就是一个链表：每个 commit 指向它的父 commit，`git log` 就是沿着这条链往前走。

### HEAD 引用系统

Git 用两种方式表示 HEAD：

```python
def get_head_commit() -> str | None:
    head = open(".git/HEAD").read().strip()
    if head.startswith("ref: "):
        # 符号引用：ref: refs/heads/main
        ref_path = os.path.join(".git", head[5:])
        if os.path.exists(ref_path):
            return open(ref_path).read().strip()
        return None
    return head  # detached HEAD：直接存 SHA1
```

- **符号引用**（normal state）：`.git/HEAD` 包含 `ref: refs/heads/main`，指向分支文件，分支文件再存 commit SHA1
- **游离 HEAD**（detached HEAD）：`.git/HEAD` 直接存 commit SHA1，`checkout <commit>` 会进入这种状态

### Checkout：从对象恢复文件

```python
def cmd_checkout(args):
    sha = args[0]
    _, content = read_object(sha)
    # 从 commit 中提取 tree SHA
    tree_sha = content.decode().split("\n")[0].split()[1]
    # 清空工作目录（除了 .git）
    for name in os.listdir("."):
        if name == ".git": continue
        full = os.path.join(".", name)
        if os.path.isdir(full): shutil.rmtree(full)
        else: os.remove(full)
    # 从 tree 递归恢复文件
    _restore_tree(tree_sha, ".")

def _restore_tree(tree_sha: str, base_path: str):
    _, content = read_object(tree_sha)
    i = 0
    while i < len(content):
        # 解析 tree 条目...
        if mode == "40000":
            os.makedirs(full, exist_ok=True)
            _restore_tree(entry_sha, full)  # 递归处理子目录
        else:
            _, blob_data = read_object(entry_sha)
            with open(full, "wb") as f:
                f.write(blob_data)
            if mode == "100755":
                os.chmod(full, 0o755)  # 恢复可执行权限
```

---

## 如何运行

```bash
cd /tmp/test-repo && mkdir test-repo && cd test-repo

# 初始化
python mini_git.py init

# 创建文件并提交
echo "hello world" > README.md
python mini_git.py hash-object -w README.md      # 存储 blob

python mini_git.py write-tree                     # 生成 tree
# 输出：a1b2c3d4...

python mini_git.py commit-tree <tree-hash> -m "initial commit"
# 输出：e5f6a7b8...

# 查看历史
python mini_git.py log

# 用真实 git 验证兼容性
git log                    # ✓ 能看到提交
git cat-file -p HEAD       # ✓ 能查看 commit 对象

# 运行 demo
bash demo.sh
```

---

## 关键收获

**1. 内容寻址是 Git 的灵魂**

Git 不是"存储文件的历史版本"，而是"存储内容的有向无环图"。相同内容的文件在整个历史中只存一份，这就是为什么 Git 比很多其他版本控制系统更省空间（直到你开始存二进制大文件）。

**2. 三种对象类型构成了全部**

整个 Git 对象模型就三种类型：blob（内容）、tree（目录）、commit（历史节点）。所有复杂的 Git 操作——merge、rebase、cherry-pick——都是在这三种对象上的图操作。理解了对象模型，这些操作就不再神秘。

**3. 暂存区是个重要的抽象**

mini-git 直接从文件系统生成 tree，跳过了暂存区（index）。真实 Git 的 index 允许你精细控制"哪些改动进入这次提交"——这是一个重要的工作流抽象，但实现起来复杂（`.git/index` 是二进制格式，包含文件状态缓存）。

**4. 格式兼容性来自简单的约定**

mini-git 能和真实 Git 互操作，是因为它遵循了同样的格式规范：
- 对象格式：`<type> <size>\0<content>`
- 压缩：zlib
- 路径：`.git/objects/XX/YYY`
- HEAD：符号引用或直接 SHA1

**5. SHA1 冲突不是真正的问题（目前）**

理论上两个不同内容可能产生相同的 SHA1（哈希碰撞），但在实践中极其罕见。Git 一直在迁移到 SHA-256（已在 Git 2.29 引入实验性支持），但 SHA1 在绝大多数使用场景下仍然安全。

**6. 递归结构让代码极其简洁**

`write-tree` 和 `_restore_tree` 都是简单的递归函数，自然处理任意深度的目录结构。这是内容寻址存储的另一个优雅之处：树的递归结构完美对应了递归算法。
