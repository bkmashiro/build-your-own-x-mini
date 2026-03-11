# 02 — mini-git

> A minimal git plumbing implementation in pure Python — ~190 lines.

## What we build

The core object model: blobs, trees, commits — all content-addressed by SHA1 hash.

## How git objects work

**Blob**: `blob <size>\0<content>`
**Tree**: `tree <size>\0[<mode> <name>\0<20-byte-hash>]+`
**Commit**: `commit <size>\0tree <hash>\nauthor ...\n\n<message>\n`

All stored compressed with zlib at `.git/objects/XX/YYYYYYY`

## Usage

```bash
python mini_git.py init
python mini_git.py hash-object -w README.md
python mini_git.py cat-file -p <hash>
python mini_git.py write-tree
python mini_git.py commit-tree <tree-hash> -m "initial commit"
python mini_git.py log
python mini_git.py checkout <commit-hash>
```

Or run the demo:
```bash
bash demo.sh
```

## How it works

### Content-addressable storage

Every object is stored by the SHA1 hash of its content (including a type+size header). This means identical content always produces the same hash — deduplication is automatic.

### Object types

- **Blob** — raw file content, nothing else. No filename, no permissions.
- **Tree** — a directory listing. Each entry: mode, filename, and the SHA1 of its blob or sub-tree. Trees reference blobs (and other trees), building a snapshot of the entire file system.
- **Commit** — points to a tree (the snapshot) plus metadata: parent commit, author, timestamp, message. Commits form a linked list — that's your history.

### The object pipeline

```
file on disk
    → hash-object → blob stored in .git/objects/
working directory
    → write-tree → tree object (recursive snapshot)
tree + message
    → commit-tree → commit object, HEAD updated
commit
    → checkout → files restored from tree → blobs
```

## What we skip

- Index/staging area (simplified: write-tree uses filesystem directly)
- Remotes, fetch, push
- Merge, rebase, branches
- Pack files, delta compression
- Proper ref management

---

## 中文摘要

mini-git 用 ~190 行 Python 实现了 git 的核心对象模型。

**核心概念：**
- **内容寻址存储**：每个对象由 SHA1 哈希唯一标识，相同内容 → 相同哈希
- **三种对象**：blob（文件内容）、tree（目录结构）、commit（快照 + 历史链）
- **zlib 压缩**：所有对象存储在 `.git/objects/XX/YYY...`，与真实 git 格式兼容

**和真实 git 的差距：** 没有暂存区（直接从文件系统生成 tree）、没有分支管理、没有远程操作、没有 pack 文件。但对象存储和提交链的核心逻辑完全一致。
