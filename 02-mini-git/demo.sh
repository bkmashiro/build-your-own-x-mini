#!/usr/bin/env bash
#
# mini-git demo — exercises all commands in a temporary directory.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MINI_GIT="python3 $SCRIPT_DIR/mini_git.py"
WORK_DIR=$(mktemp -d)
PASS=0
FAIL=0

cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

check() {
    local desc="$1" ok="$2"
    if [ "$ok" = "true" ]; then
        echo "  ✓ $desc"
        PASS=$((PASS + 1))
    else
        echo "  ✗ $desc"
        FAIL=$((FAIL + 1))
    fi
}

cd "$WORK_DIR"

echo
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  build-your-own-x-mini: mini-git demo & tests           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo

# ── init ───────────────────────────────────────────────────────
echo "── init ─────────────────────────────────────────────────────"
$MINI_GIT init
check "creates .git/objects" "$([ -d .git/objects ] && echo true || echo false)"
check "creates .git/refs"    "$([ -d .git/refs ] && echo true || echo false)"
check "creates .git/HEAD"    "$([ -f .git/HEAD ] && echo true || echo false)"
check "HEAD points to refs/heads/main" "$(grep -q 'ref: refs/heads/main' .git/HEAD && echo true || echo false)"
echo

# ── hash-object ────────────────────────────────────────────────
echo "── hash-object ──────────────────────────────────────────────"
echo "hello world" > hello.txt
HASH=$($MINI_GIT hash-object -w hello.txt)
check "returns 40-char SHA1"    "$([ ${#HASH} -eq 40 ] && echo true || echo false)"
check "object file exists"      "$([ -f .git/objects/${HASH:0:2}/${HASH:2} ] && echo true || echo false)"

# same content → same hash (content-addressable)
echo "hello world" > hello2.txt
HASH2=$($MINI_GIT hash-object hello2.txt)
check "same content → same hash" "$([ "$HASH" = "$HASH2" ] && echo true || echo false)"
echo

# ── cat-file ───────────────────────────────────────────────────
echo "── cat-file ─────────────────────────────────────────────────"
CONTENT=$($MINI_GIT cat-file -p "$HASH")
check "cat-file recovers content" "$([ "$CONTENT" = "hello world" ] && echo true || echo false)"
echo

# ── write-tree ─────────────────────────────────────────────────
echo "── write-tree ───────────────────────────────────────────────"
# clean up extra file
rm hello2.txt
mkdir -p src
echo 'print("hi")' > src/main.py
TREE=$($MINI_GIT write-tree)
check "returns 40-char SHA1"  "$([ ${#TREE} -eq 40 ] && echo true || echo false)"

# cat-file on tree should show entries
TREE_OUT=$($MINI_GIT cat-file -p "$TREE")
check "tree contains hello.txt"  "$(echo "$TREE_OUT" | grep -q hello.txt && echo true || echo false)"
check "tree contains src/"       "$(echo "$TREE_OUT" | grep -q src && echo true || echo false)"
echo

# ── commit-tree ──────────────────────────────────────────────
echo "── commit-tree ──────────────────────────────────────────────"
COMMIT1=$($MINI_GIT commit-tree "$TREE" -m "initial commit")
check "returns 40-char SHA1"   "$([ ${#COMMIT1} -eq 40 ] && echo true || echo false)"

# cat-file on commit should show tree and message
COMMIT_OUT=$($MINI_GIT cat-file -p "$COMMIT1")
check "commit references tree"   "$(echo "$COMMIT_OUT" | grep -q "tree $TREE" && echo true || echo false)"
check "commit has message"        "$(echo "$COMMIT_OUT" | grep -q "initial commit" && echo true || echo false)"
check "commit has author"         "$(echo "$COMMIT_OUT" | grep -q "author" && echo true || echo false)"

# HEAD should now point to this commit
HEAD_REF=$(cat .git/refs/heads/main)
check "HEAD updated to commit" "$([ "${HEAD_REF%%[[:space:]]}" = "$COMMIT1" ] && echo true || echo false)"
echo

# ── second commit (with parent) ──────────────────────────────
echo "── second commit (parent chain) ─────────────────────────────"
echo "version 2" >> hello.txt
TREE2=$($MINI_GIT write-tree)
COMMIT2=$($MINI_GIT commit-tree "$TREE2" -m "update hello")
COMMIT2_OUT=$($MINI_GIT cat-file -p "$COMMIT2")
check "second commit has parent"  "$(echo "$COMMIT2_OUT" | grep -q "parent $COMMIT1" && echo true || echo false)"
echo

# ── log ──────────────────────────────────────────────────────
echo "── log ──────────────────────────────────────────────────────"
LOG=$($MINI_GIT log)
check "log shows both commits"   "$([ "$(echo "$LOG" | grep -c "commit ")" -eq 2 ] && echo true || echo false)"
check "log shows messages"       "$(echo "$LOG" | grep -q "update hello" && echo "$LOG" | grep -q "initial commit" && echo true || echo false)"
echo

# ── checkout ─────────────────────────────────────────────────
echo "── checkout ─────────────────────────────────────────────────"
# hello.txt currently has 2 lines; checkout first commit should restore 1 line
$MINI_GIT checkout "$COMMIT1"
LINES=$(wc -l < hello.txt | tr -d ' ')
check "checkout restores files"    "$([ "$LINES" -eq 1 ] && echo true || echo false)"
check "checkout restores content"  "$(grep -q 'hello world' hello.txt && echo true || echo false)"
check "src/main.py restored"       "$([ -f src/main.py ] && echo true || echo false)"
echo

# ── summary ──────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════"
if [ $FAIL -eq 0 ]; then
    echo "  All $PASS tests passed! ✓"
else
    echo "  $PASS passed, $FAIL failed ✗"
fi
echo
