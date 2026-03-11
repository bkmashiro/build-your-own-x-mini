#!/usr/bin/env python3
"""
mini-git: A minimal git implementation in Python.

Implements: init, hash-object, cat-file, write-tree, commit-tree, log, checkout

All objects stored as zlib-compressed data at .git/objects/XX/YYYYYY...
Format: <type> <size>\0<content>, keyed by SHA1 — same as real git.
"""

import hashlib
import os
import shutil
import sys
import time
import zlib


# ─────────────────────────────────────────────────────────────
# Object Store
# ─────────────────────────────────────────────────────────────
# Git objects: blob, tree, commit — each content-addressed by SHA1.
# Stored at .git/objects/XX/YYY... (XX = first 2 hex chars of hash).

def object_path(sha: str) -> str:
    return os.path.join(".git", "objects", sha[:2], sha[2:])


def hash_object(data: bytes, obj_type: str = "blob", write: bool = False) -> str:
    """Compute SHA1 of git object: '<type> <size>\0<content>'."""
    header = f"{obj_type} {len(data)}\0".encode()
    full = header + data
    sha = hashlib.sha1(full).hexdigest()
    if write:
        path = object_path(sha)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if not os.path.exists(path):  # content-addressable — no need to overwrite
            with open(path, "wb") as f:
                f.write(zlib.compress(full))
    return sha


def read_object(sha: str) -> tuple[str, bytes]:
    """Read and decompress a git object. Returns (type, content)."""
    path = object_path(sha)
    with open(path, "rb") as f:
        raw = zlib.decompress(f.read())
    null_idx = raw.index(b"\0")
    header = raw[:null_idx].decode()
    obj_type = header.split(" ", 1)[0]
    content = raw[null_idx + 1:]
    return obj_type, content


# ─────────────────────────────────────────────────────────────
# HEAD helpers
# ─────────────────────────────────────────────────────────────

def get_head_commit() -> str | None:
    """Resolve HEAD → commit SHA (follows symbolic refs)."""
    head = open(".git/HEAD").read().strip()
    if head.startswith("ref: "):
        ref_path = os.path.join(".git", head[5:])
        if os.path.exists(ref_path):
            return open(ref_path).read().strip()
        return None
    return head  # detached HEAD


def update_head(sha: str):
    """Point HEAD (or the ref it points to) at a new commit."""
    head = open(".git/HEAD").read().strip()
    if head.startswith("ref: "):
        ref_path = os.path.join(".git", head[5:])
        os.makedirs(os.path.dirname(ref_path), exist_ok=True)
        with open(ref_path, "w") as f:
            f.write(sha + "\n")
    else:
        with open(".git/HEAD", "w") as f:
            f.write(sha + "\n")


# ─────────────────────────────────────────────────────────────
# Commands
# ─────────────────────────────────────────────────────────────

def cmd_init():
    """Create .git/ directory structure."""
    for d in [".git/objects", ".git/refs"]:
        os.makedirs(d, exist_ok=True)
    with open(".git/HEAD", "w") as f:
        f.write("ref: refs/heads/main\n")
    print(f"Initialized empty mini-git repository in {os.path.abspath('.git')}")


def cmd_hash_object(args):
    """Hash a file and optionally write it to the object store."""
    write = "-w" in args
    filepath = [a for a in args if a != "-w"][0]
    with open(filepath, "rb") as f:
        data = f.read()
    sha = hash_object(data, "blob", write=write)
    print(sha)


def cmd_cat_file(args):
    """Pretty-print a git object."""
    if len(args) < 2 or args[0] != "-p":
        print("usage: mini_git.py cat-file -p <hash>", file=sys.stderr)
        sys.exit(1)
    obj_type, content = read_object(args[1])
    if obj_type == "tree":
        # Tree entries: <mode> <name>\0<20-byte-sha1> (packed binary)
        i = 0
        while i < len(content):
            space = content.index(b" ", i)
            mode = content[i:space].decode()
            null = content.index(b"\0", space)
            name = content[space + 1:null].decode()
            entry_sha = content[null + 1:null + 21].hex()
            entry_type = "tree" if mode == "40000" else "blob"
            print(f"{mode:>06} {entry_type} {entry_sha}    {name}")
            i = null + 21
    else:
        sys.stdout.buffer.write(content)


def cmd_write_tree(path="."):
    """Recursively create tree objects from the working directory."""
    entries = []
    for name in sorted(os.listdir(path)):
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
            sha = cmd_write_tree(full)  # recurse into subdirectories
            entries.append(("40000", name, sha))
    # Tree format: [<mode> <name>\0<20-byte-sha>]+
    tree_data = b""
    for mode, name, sha in entries:
        tree_data += f"{mode} {name}\0".encode() + bytes.fromhex(sha)
    sha = hash_object(tree_data, "tree", write=True)
    if path == ".":
        print(sha)
    return sha


def cmd_commit_tree(args):
    """Create a commit object pointing to a tree."""
    tree_sha = args[0]
    message = ""
    parent = None
    i = 1
    while i < len(args):
        if args[i] == "-m" and i + 1 < len(args):
            message = args[i + 1]; i += 2
        elif args[i] == "-p" and i + 1 < len(args):
            parent = args[i + 1]; i += 2
        else:
            i += 1
    # Auto-detect parent from HEAD if not specified
    if parent is None:
        parent = get_head_commit()
    # Build commit content
    timestamp = int(time.time())
    author = f"Mini Git <mini@git> {timestamp} +0000"
    lines = [f"tree {tree_sha}"]
    if parent:
        lines.append(f"parent {parent}")
    lines += [f"author {author}", f"committer {author}", "", message, ""]
    content = "\n".join(lines).encode()
    sha = hash_object(content, "commit", write=True)
    update_head(sha)
    print(sha)


def cmd_log():
    """Walk the commit chain from HEAD and print history."""
    sha = get_head_commit()
    if not sha:
        print("fatal: no commits yet", file=sys.stderr)
        sys.exit(1)
    while sha:
        _, content = read_object(sha)
        text = content.decode()
        print(f"\033[33mcommit {sha}\033[0m")
        parent_sha = None
        for line in text.split("\n"):
            if line.startswith("author "):
                # "author Name <email> timestamp tz"
                parts = line.split()
                ts = int(parts[-2])
                name = " ".join(parts[1:-2])
                print(f"Author: {name}")
                print(f"Date:   {time.strftime('%c', time.localtime(ts))}")
            elif line.startswith("parent "):
                parent_sha = line.split()[1]
        # Message is after the blank line
        msg = text[text.index("\n\n") + 2:].strip()
        print(f"\n    {msg}\n")
        sha = parent_sha


def cmd_checkout(args):
    """Restore the working tree from a commit."""
    sha = args[0]
    obj_type, content = read_object(sha)
    if obj_type != "commit":
        print(f"fatal: not a commit: {sha}", file=sys.stderr)
        sys.exit(1)
    tree_sha = content.decode().split("\n")[0].split()[1]
    # Clear working directory (except .git)
    for name in os.listdir("."):
        if name == ".git":
            continue
        full = os.path.join(".", name)
        if os.path.isdir(full):
            shutil.rmtree(full)
        else:
            os.remove(full)
    # Restore from tree
    _restore_tree(tree_sha, ".")
    # Update HEAD to point at this commit (detached)
    with open(".git/HEAD", "w") as f:
        f.write(sha + "\n")
    print(f"HEAD is now at {sha[:7]}")


def _restore_tree(tree_sha: str, base_path: str):
    """Recursively restore files from a tree object."""
    _, content = read_object(tree_sha)
    i = 0
    while i < len(content):
        space = content.index(b" ", i)
        mode = content[i:space].decode()
        null = content.index(b"\0", space)
        name = content[space + 1:null].decode()
        entry_sha = content[null + 1:null + 21].hex()
        i = null + 21
        full = os.path.join(base_path, name)
        if mode == "40000":  # directory
            os.makedirs(full, exist_ok=True)
            _restore_tree(entry_sha, full)
        else:  # file
            _, blob_data = read_object(entry_sha)
            with open(full, "wb") as f:
                f.write(blob_data)
            if mode == "100755":
                os.chmod(full, 0o755)


# ─────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────

COMMANDS = {
    "init": (cmd_init, False),
    "hash-object": (cmd_hash_object, True),
    "cat-file": (cmd_cat_file, True),
    "write-tree": (cmd_write_tree, False),
    "commit-tree": (cmd_commit_tree, True),
    "log": (cmd_log, False),
    "checkout": (cmd_checkout, True),
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print("usage: mini_git.py <command> [<args>]")
        print("commands: init, hash-object, cat-file, write-tree, commit-tree, log, checkout")
        sys.exit(1)
    fn, needs_args = COMMANDS[sys.argv[1]]
    fn(sys.argv[2:]) if needs_args else fn()


if __name__ == "__main__":
    main()
