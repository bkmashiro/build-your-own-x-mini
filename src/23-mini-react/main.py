"""
mini-react — virtual DOM, fiber reconciler, useState/useEffect from scratch.
No external libraries. < 200 lines of pure Python.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

# ── Virtual DOM ────────────────────────────────────────────────────────────────

@dataclass
class VNode:
    type: str
    props: Dict[str, Any]
    children: List["VNode"]
    text: Optional[str] = None

@dataclass
class DOMNode:
    tag: str
    attrs: Dict[str, Any] = field(default_factory=dict)
    children: List["DOMNode"] = field(default_factory=list)
    text: Optional[str] = None

@dataclass
class Fiber:
    vnode: VNode
    parent: Optional["Fiber"] = None
    child: Optional["Fiber"] = None
    sibling: Optional["Fiber"] = None
    dom: Optional[DOMNode] = None
    effect: str = "NONE"   # PLACE | UPDATE

# ── createElement (JSX equivalent) ────────────────────────────────────────────

def createElement(tag: str, props: Dict = None, *children) -> VNode:
    props = props or {}
    vnodes: List[VNode] = []
    for c in children:
        if isinstance(c, list):
            children = (*children, *c); continue  # flatten
        if isinstance(c, str):
            vnodes.append(VNode("text", {}, [], c))
        elif isinstance(c, VNode):
            vnodes.append(c)
    return VNode(tag, props, vnodes)

# ── Runtime / Hook engine ──────────────────────────────────────────────────────

class _Runtime:
    def __init__(self):
        self.states: List[Any] = []
        self.effects: List[Tuple[Callable, Any]] = []
        self.hook_idx: int = 0
        self.root_fn: Optional[Callable] = None
        self.container: Optional[DOMNode] = None
        self.pending_effects: List[Tuple[Callable, Any]] = []

    def reset(self):
        self.hook_idx = 0
        self.pending_effects = []

_rt = _Runtime()

# ── Hooks ──────────────────────────────────────────────────────────────────────

def useState(initial: Any):
    i = _rt.hook_idx; _rt.hook_idx += 1
    if i >= len(_rt.states):
        _rt.states.append(initial)

    def set_state(val: Any):
        _rt.states[i] = val
        if _rt.root_fn:
            _render_cycle()

    return _rt.states[i], set_state

def useEffect(fn: Callable, deps: List[Any] = None):
    i = _rt.hook_idx; _rt.hook_idx += 1
    if i >= len(_rt.effects):
        _rt.effects.append((fn, None))
        _rt.pending_effects.append(fn)
        return
    _, prev_deps = _rt.effects[i]
    if deps is None or prev_deps != deps:
        _rt.effects[i] = (fn, deps)
        _rt.pending_effects.append(fn)

# ── Reconciler (fiber diff) ────────────────────────────────────────────────────

def _build_fibers(vnode: VNode, parent: Optional[Fiber],
                  old_fiber: Optional[Fiber]) -> Fiber:
    """Recursively build fiber tree with diff tagging."""
    fiber = Fiber(vnode=vnode, parent=parent)

    # Create or reuse DOM node
    if old_fiber and old_fiber.vnode.type == vnode.type:
        fiber.dom = old_fiber.dom
        fiber.effect = "UPDATE"
        if fiber.dom:
            if vnode.type == "text":
                fiber.dom.text = vnode.text    # update text content in-place
            else:
                fiber.dom.attrs = dict(vnode.props)  # replace attrs fully
    else:
        fiber.effect = "PLACE"
        if vnode.type == "text":
            fiber.dom = DOMNode("text", text=vnode.text)
        else:
            fiber.dom = DOMNode(vnode.type, attrs=dict(vnode.props))

    # Reconcile children
    old_children: List[Fiber] = []
    if old_fiber:
        c = old_fiber.child
        while c:
            old_children.append(c); c = c.sibling

    prev: Optional[Fiber] = None
    for idx, child_vnode in enumerate(vnode.children):
        old_c = old_children[idx] if idx < len(old_children) else None
        child_fiber = _build_fibers(child_vnode, fiber, old_c)
        if idx == 0:
            fiber.child = child_fiber
        else:
            prev.sibling = child_fiber  # type: ignore[union-attr]
        prev = child_fiber

    return fiber

def _commit(fiber: Optional[Fiber]) -> None:
    """DFS: attach dom to parent. Clears parent children once per cycle."""
    if fiber is None: return
    if fiber.parent and fiber.parent.dom and fiber.dom:
        dom_list = fiber.parent.dom.children
        if not getattr(fiber.parent.dom, "_cleared", False):
            dom_list.clear()
            fiber.parent.dom._cleared = True  # type: ignore[attr-defined]
        dom_list.append(fiber.dom)
    _commit(fiber.child)
    _commit(fiber.sibling)

# ── Render ─────────────────────────────────────────────────────────────────────

_root_fiber: Optional[Fiber] = None

def _reset_cleared(dom: Optional[DOMNode]) -> None:
    if dom is None: return
    if hasattr(dom, "_cleared"): del dom._cleared  # type: ignore[attr-defined]
    for child in dom.children: _reset_cleared(child)

def _render_cycle():
    global _root_fiber
    _rt.reset()
    vnode = _rt.root_fn()               # call component (hooks fire here)
    wrapper = VNode("root", {}, [vnode])
    root = Fiber(vnode=wrapper, dom=_rt.container)
    root.child = _build_fibers(vnode, root,
                                _root_fiber.child if _root_fiber else None)
    # Reset cleared sentinels from prior cycle, then clear container
    _reset_cleared(_rt.container)
    _rt.container.children.clear()
    _rt.container._cleared = True  # type: ignore[attr-defined]
    _commit(root.child)
    _root_fiber = root
    for fn in _rt.pending_effects:      # flush effects after paint
        fn()

def render(component_fn: Callable, container: DOMNode = None) -> DOMNode:
    """Mount component into container."""
    global _root_fiber
    _root_fiber = None
    _rt.states.clear(); _rt.effects.clear()
    _rt.root_fn = component_fn
    _rt.container = container or DOMNode("root")
    _render_cycle()
    return _rt.container

# ── Serializer ─────────────────────────────────────────────────────────────────

def to_string(node: DOMNode, indent: int = 0) -> str:
    pad = "  " * indent
    if node.tag == "text":
        return pad + (node.text or "")
    attrs = " ".join(f'{k}="{v}"' for k, v in node.attrs.items()
                     if not callable(v) and k != "key")
    attrs_str = (" " + attrs) if attrs else ""
    if not node.children:
        return f"{pad}<{node.tag}{attrs_str} />"
    inner = "\n".join(to_string(c, indent + 1) for c in node.children)
    return f"{pad}<{node.tag}{attrs_str}>\n{inner}\n{pad}</{node.tag}>"

def get_output(container: DOMNode) -> str:
    return "\n".join(to_string(c) for c in container.children)
