"""
mini-react demos: Counter UI + TodoList
Each demo shows how useState/useEffect drive re-renders.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from main import createElement as h, render, get_output, useState, useEffect

# ──────────────────────────────────────────────────────────────────────────────
# Demo 1: Counter
# ──────────────────────────────────────────────────────────────────────────────

# Module-level setters so we can drive them outside the component
_set_count = None

def Counter():
    global _set_count
    count, set_count = useState(0)
    _set_count = set_count
    useEffect(lambda: print(f"  [effect] count changed → {count}"), [count])
    return h("div", {"class": "counter"},
        h("h1", {}, f"Count: {count}"),
        h("button", {"onClick": "increment"}, "+ Increment"),
        h("button", {"onClick": "decrement"}, "- Decrement"),
    )

def demo_counter():
    print("=" * 50)
    print("Demo 1: Counter")
    print("=" * 50)

    container = render(Counter)
    print("\n[Initial render — count=0]")
    print(get_output(container))

    # Simulate clicking "+ Increment" 3 times
    for i in range(1, 4):
        _set_count(i)
    print(f"\n[After 3 increments — count=3]")
    print(get_output(container))

    _set_count(2)
    print(f"\n[After 1 decrement — count=2]")
    print(get_output(container))

# ──────────────────────────────────────────────────────────────────────────────
# Demo 2: TodoList
# ──────────────────────────────────────────────────────────────────────────────

_set_todos = None
_set_filter = None
_set_done = None

def TodoList():
    global _set_todos, _set_filter, _set_done

    todos, set_todos   = useState(["Buy milk", "Write code", "Go for a walk"])
    filter_, set_filter = useState("all")
    done_set, set_done = useState(set())

    _set_todos  = set_todos
    _set_filter = set_filter
    _set_done   = set_done

    useEffect(lambda: print(f"  [effect] todos updated, total={len(todos)}"), [len(todos)])

    visible = {
        "all":     todos,
        "done":    [t for t in todos if t in done_set],
        "pending": [t for t in todos if t not in done_set],
    }.get(filter_, todos)

    items = [
        h("li", {"class": "done" if t in done_set else "todo"},
          f"{'✓' if t in done_set else '○'} {t}")
        for t in visible
    ]

    return h("div", {"class": "app"},
        h("h1", {}, "📝 TodoList"),
        h("div", {"class": "filters"},
            h("span", {"class": "active" if filter_ == "all"     else ""}, "[all]"),
            h("span", {"class": "active" if filter_ == "done"    else ""}, "[done]"),
            h("span", {"class": "active" if filter_ == "pending" else ""}, "[pending]"),
        ),
        h("ul", {}, *items) if items else h("p", {}, "(empty)"),
        h("p", {}, f"{len(done_set)}/{len(todos)} completed"),
    )

def demo_todolist():
    print("\n" + "=" * 50)
    print("Demo 2: TodoList")
    print("=" * 50)

    container = render(TodoList)
    print("\n[Initial render]")
    print(get_output(container))

    # Mark "Buy milk" as done
    from main import _rt
    current_done = set(_rt.states[2])  # read current done_set
    current_todos = _rt.states[0]
    current_done.add(current_todos[0])
    _set_done(current_done)
    print(f"\n[After marking '{current_todos[0]}' as done]")
    print(get_output(container))

    # Add a new todo
    _set_todos(_rt.states[0] + ["Read a book"])
    print(f"\n[After adding 'Read a book']")
    print(get_output(container))

    # Switch filter to 'done'
    _set_filter("done")
    print(f"\n[Filter: done only]")
    print(get_output(container))

    # Switch filter to 'pending'
    _set_filter("pending")
    print(f"\n[Filter: pending only]")
    print(get_output(container))

    # Back to all
    _set_filter("all")
    print(f"\n[Filter: all (back to overview)]")
    print(get_output(container))

# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    demo_counter()
    demo_todolist()
    print("\n✅ All demos complete.")
