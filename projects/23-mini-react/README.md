# mini-react

A minimal React-like renderer in ~200 lines of Python.
Implements virtual DOM, a fiber reconciler, and `useState` / `useEffect` hooks from scratch.

## Concepts

| Concept | Description |
|---------|-------------|
| **VNode** | Immutable virtual DOM node (`type`, `props`, `key`) |
| **Fiber** | Mutable work unit — holds DOM reference, hooks list, and alternate pointer |
| **Reconciler** | Diffs old vs new fiber trees and tags each fiber: `PLACEMENT`, `UPDATE`, or `DELETION` |
| **Commit phase** | Flushes all effect tags to the DOM in one synchronous pass |
| **`useState`** | Stores `{state, queue}` in `fiber.hooks`; queued actions are replayed on re-render |
| **`useEffect`** | Callbacks collected during render, flushed after the commit phase |

## Architecture

```
render(vnode, container)
  │
  ├─ build wip_root Fiber (alternate = current_root)
  │
  ├─ _perform_work()          ← depth-first fiber traversal
  │    └─ _begin_work(fiber)
  │         ├─ function component → call fn, reconcile returned children
  │         └─ host element     → create DOM node, reconcile children
  │
  └─ _commit_root()
       ├─ process deletions
       ├─ _commit_work()       ← walk fiber tree, apply effect tags
       └─ flush useEffect callbacks
```

## Usage

```python
from mini_react import h, render, use_state, use_effect, DOMNode

def Counter(props):
    count, set_count = use_state(0)
    use_effect(lambda: print(f"count is now {count}"), [count])
    return h("div", {}, f"Count: {count}")

root = DOMNode("body", {})
render(h(Counter, {}), root)
print(root.render())
# <body>
#   <div>
#     Count: 0
#   </div>
# </body>
```

## Demo

```bash
python demo.py
```

The demo shows:
1. Initial render of a nested component tree
2. Counter state update (+1) via hook queue
3. Cumulative state updates (+4)
4. List reconciliation (appending a todo item)

## Files

```
src/mini_react.py   ~215 lines — core implementation
demo.py             interactive demo
```

## Key simplifications vs real React

- No async / concurrent rendering (work loop runs synchronously)
- No `key`-based list reconciliation (keys parsed but not used for reordering)
- DOM is a Python object tree rendered as HTML strings (no browser)
- No `useReducer`, `useRef`, `useContext`, `useMemo`
