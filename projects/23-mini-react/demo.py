"""demo.py — mini-react: counter, todo list, reconciler diff"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from mini_react import h, render, use_state, use_effect, DOMNode, Fiber, _renderer

# ---------------------------------------------------------------------------
# Components
# ---------------------------------------------------------------------------

def Counter(props):
    count, set_count = use_state(0)
    return h("div", {"class": "counter"},
        h("h2", {}, f"Count: {count}"),
    )

def TodoItem(props):
    return h("li", {}, props["text"])

def TodoList(props):
    items, _ = use_state(props.get("initial", []))
    return h("ul", {"class": "todos"},
        *[h(TodoItem, {"text": t}) for t in items]
    )

def App(props):
    title, _ = use_state("mini-react")
    use_effect(lambda: print("  [effect] mounted/updated"), [])
    return h("div", {"id": "app"},
        h("h1", {}, title),
        h(Counter, {}),
        h(TodoList, {"initial": ["Learn fibers", "Build hooks", "Ship it"]}),
    )

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def section(title):
    print(f"\n{'='*55}\n  {title}\n{'='*55}")

def find_fiber(f, target_type):
    if f is None: return None
    if callable(f.vnode.type) and f.vnode.type is target_type: return f
    r = find_fiber(f.child, target_type)
    if r: return r
    return find_fiber(f.sibling, target_type)

def trigger_update(fiber_type, action):
    """Push a state action to a component fiber and re-render."""
    cur = _renderer._current_root
    cf = find_fiber(cur, fiber_type)
    if cf and cf.hooks:
        cf.hooks[0]["queue"].append(action)
        _renderer._wip_root = Fiber(vnode=cur.vnode, dom=cur.dom, alternate=cur)
        _renderer._deletions = []
        _renderer._perform_work(_renderer._wip_root)
        _renderer._commit_root()

# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    root = DOMNode("body", {})

    section("1. Initial render")
    render(h(App, {}), root)
    print(root.render())

    section("2. Counter +1  (state update via hook queue)")
    trigger_update(Counter, lambda s: s + 1)
    print(root.render())

    section("3. Counter +4  (cumulative state)")
    for _ in range(4):
        trigger_update(Counter, lambda s: s + 1)
    print(root.render())

    section("4. Add todo item (list reconciliation)")
    trigger_update(TodoList, lambda items: items + ["Done!"])
    print(root.render())

    section("5. Architecture summary")
    print("""
  VNode      immutable virtual DOM node (type + props + key)
  Fiber      mutable work unit — holds DOM ref, hooks, alternate
  Reconciler diff old/new fiber trees → PLACEMENT/UPDATE/DELETION
  Commit     flush effect tags to DOM in one synchronous pass
  useState   hook stores {state, queue} in fiber.hooks list
  useEffect  callbacks flushed after each commit phase
    """)
