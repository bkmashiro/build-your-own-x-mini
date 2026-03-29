# mini-react

> Virtual DOM, fiber reconciler, and hooks (useState/useEffect) from scratch — no frameworks, ~195 lines of pure Python.

**[日本語](#日本語)**

---

## Overview

This project implements the core ideas behind React in ~195 lines of Python:

- **Virtual DOM** — lightweight node trees that represent UI state
- **Fiber reconciler** — iterative tree diffing that tracks what changed
- **Hooks** — `useState` and `useEffect` with closure-based state persistence
- **Text renderer** — serializes the virtual DOM to human-readable XML strings

---

## Architecture

```
  Component Function
       │
       ▼
  createElement()  ──▶  VNode tree (virtual DOM)
       │
       ▼
  _build_fibers()  ──▶  Fiber tree (with diff tags: PLACE / UPDATE)
       │
       ▼
   _commit()       ──▶  DOMNode tree (concrete nodes, parent↔child links)
       │
       ▼
   to_string()     ──▶  Text output (human-readable XML)
```

### Core Components

| Component | Lines | Role |
|-----------|-------|------|
| `VNode` | dataclass | Immutable virtual DOM node |
| `DOMNode` | dataclass | Mutable "real" DOM node |
| `Fiber` | dataclass | Work unit: diff tag + parent/child/sibling links |
| `_Runtime` | class | Hook engine: state slots, effect queue |
| `createElement` | func | Build VNode trees (like JSX) |
| `useState` | hook | Per-slot state with setter that triggers re-render |
| `useEffect` | hook | Side-effect scheduling with dependency comparison |
| `_build_fibers` | func | Recursive reconciler: diff old vs new |
| `_commit` | func | DFS commit: wire DOMNodes, clear stale children |
| `render` | func | Mount a component and return the container |
| `get_output` | func | Serialize DOMNode tree to a string |

---

## Usage

```python
from main import createElement as h, render, get_output, useState, useEffect

# ── Define a component ─────────────────────────────────────────────────────────

def Counter():
    count, set_count = useState(0)
    useEffect(lambda: print(f"count is now {count}"), [count])
    return h("div", {"class": "counter"},
        h("h1", {}, f"Count: {count}"),
        h("button", {"onClick": lambda: set_count(count + 1)}, "+ Increment"),
    )

# ── Mount and render ───────────────────────────────────────────────────────────

container = render(Counter)
print(get_output(container))
# <div class="counter">
#   <h1>
#     Count: 0
#   </h1>
#   <button onClick="...">
#     + Increment
#   </button>
# </div>

# ── Trigger a state update ─────────────────────────────────────────────────────
# (Normally done via event handlers; in tests, call set_count directly)
set_count(1)   # triggers re-render automatically
print(get_output(container))   # Count: 1
```

### Run the demos

```bash
python3 demo.py
```

Two demos are included:

1. **Counter** — basic `useState` + increment/decrement
2. **TodoList** — multiple state slots, filter views, `useEffect` on deps change

---

## 日本語

### 概要

React のコアアイデアを Python 約 195 行で再実装したものです。

- **Virtual DOM** — UI 状態を表す軽量ノードツリー
- **Fiber Reconciler** — 変更箇所を追跡するツリー差分アルゴリズム
- **Hooks** — クロージャーベースの状態管理（useState / useEffect）
- **テキストレンダラー** — 仮想 DOM を人間が読みやすい XML 文字列に変換

### アーキテクチャ

```
コンポーネント関数
     │
     ▼
createElement()  ──▶  VNode ツリー（仮想DOM）
     │
     ▼
_build_fibers()  ──▶  Fiber ツリー（差分タグ: PLACE / UPDATE）
     │
     ▼
_commit()        ──▶  DOMNode ツリー（実際のノード）
     │
     ▼
to_string()      ──▶  テキスト出力（人間が読める XML）
```

### 主要コンポーネント

| コンポーネント | 役割 |
|---------------|------|
| `VNode` | イミュータブルな仮想 DOM ノード |
| `DOMNode` | ミュータブルな「実」DOM ノード |
| `Fiber` | 作業単位：差分タグ + 親子兄弟リンク |
| `_Runtime` | フック管理：状態スロット、エフェクトキュー |
| `createElement` | VNode ツリーの構築（JSX 相当） |
| `useState` | スロットごとの状態＋再レンダリングをトリガーするセッター |
| `useEffect` | 依存関係比較付きの副作用スケジューリング |
| `_build_fibers` | 再帰的な Reconciler：新旧ツリーの差分計算 |
| `_commit` | DFS コミット：DOMNode を接続し古い子を消去 |
| `render` | コンポーネントをマウントしてコンテナを返す |
| `get_output` | DOMNode ツリーを文字列にシリアライズ |

### 使い方

```python
from main import createElement as h, render, get_output, useState, useEffect

def MyComponent():
    value, set_value = useState("hello")
    useEffect(lambda: print(f"value changed: {value}"), [value])
    return h("div", {}, h("p", {}, value))

container = render(MyComponent)
print(get_output(container))
```

### デモの実行

```bash
python3 demo.py
```

---

## Learning Points / 学習ポイント

1. **Virtual DOM の目的** — 毎回 DOM 全体を再構築するのではなく、軽量な VNode ツリーを比較して必要な箇所だけ更新する
2. **Fiber = 作業単位** — ツリー走査を中断・再開できる設計（React の Concurrent Mode の基礎）
3. **Hooks = スロットベースの状態** — `useState` は呼び出し順で決まるスロット番号で状態を管理する（なぜ条件分岐の中で hooks を呼べないか）
4. **useEffect の依存配列** — 前回の deps と比較して、変化があった時だけエフェクトを再実行
5. **Reconciler の diff** — 同じインデックスの旧 Fiber と比較してタイプが同じなら UPDATE、違えば PLACE タグを付ける

---

*Part of the [build-your-own-x-mini](../../README.md) series.*
