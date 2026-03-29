"""mini_react.py — Virtual DOM, fiber reconciler, useState/useEffect hooks"""
from __future__ import annotations
from typing import Any, Callable, Optional
from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# VNode — virtual DOM element
# ---------------------------------------------------------------------------

@dataclass
class VNode:
    type: str | Callable
    props: dict
    key: Optional[str] = None

def h(type_: str | Callable, props: dict | None = None, *children) -> VNode:
    p = dict(props or {})
    flat: list = []
    for c in children:
        flat.extend(c) if isinstance(c, list) else flat.append(c)
    p["children"] = flat
    return VNode(type=type_, props=p)

# ---------------------------------------------------------------------------
# Fiber — unit of work
# ---------------------------------------------------------------------------

@dataclass
class Fiber:
    vnode: VNode | None
    dom: Any = None
    parent: Optional["Fiber"] = None
    child: Optional["Fiber"] = None
    sibling: Optional["Fiber"] = None
    alternate: Optional["Fiber"] = None
    effect_tag: str = ""       # PLACEMENT | UPDATE | DELETION
    hooks: list = field(default_factory=list)

# ---------------------------------------------------------------------------
# DOM abstraction (text-mode renderer)
# ---------------------------------------------------------------------------

class DOMNode:
    def __init__(self, tag: str, props: dict):
        self.tag = tag
        self.props = {k: v for k, v in props.items() if k != "children"}
        self.children: list = []

    def append(self, child): self.children.append(child)
    def remove(self, child):
        if child in self.children: self.children.remove(child)

    def update_props(self, new_props: dict, old_props: dict):
        for k, v in new_props.items():
            if k != "children": self.props[k] = v
        for k in list(old_props):
            if k not in new_props and k != "children": self.props.pop(k, None)

    def render(self, indent: int = 0) -> str:
        pad = "  " * indent
        attrs = "".join(f' {k}="{v}"' for k, v in self.props.items())
        if not self.children:
            return f"{pad}<{self.tag}{attrs} />"
        lines = [f"{pad}<{self.tag}{attrs}>"]
        for c in self.children:
            lines.append(c.render(indent + 1) if isinstance(c, DOMNode) else f"{'  '*(indent+1)}{c}")
        lines.append(f"{pad}</{self.tag}>")
        return "\n".join(lines)

def _create_dom(vnode: VNode):
    if vnode.type == "TEXT":
        return str(vnode.props.get("nodeValue", ""))
    return DOMNode(str(vnode.type), vnode.props)

def _text_vnode(val: Any) -> VNode:
    return VNode(type="TEXT", props={"nodeValue": str(val)})

# ---------------------------------------------------------------------------
# Reconciler / renderer
# ---------------------------------------------------------------------------

class Renderer:
    def __init__(self):
        self._wip_root: Optional[Fiber] = None
        self._current_root: Optional[Fiber] = None
        self._deletions: list[Fiber] = []
        self._wip_fiber: Optional[Fiber] = None
        self._hook_index: int = 0
        self._pending_effects: list[tuple] = []

    def render(self, vnode: VNode, container: DOMNode):
        self._wip_root = Fiber(
            vnode=VNode(type="ROOT", props={"children": [vnode]}),
            dom=container, alternate=self._current_root,
        )
        self._deletions = []
        self._perform_work(self._wip_root)
        self._commit_root()

    # hooks ------------------------------------------------------------------

    def use_state(self, initial: Any):
        fiber = self._wip_fiber
        idx = self._hook_index
        old_hooks = fiber.alternate.hooks if fiber and fiber.alternate else []
        old_hook = old_hooks[idx] if idx < len(old_hooks) else None
        hook = {"state": old_hook["state"] if old_hook else initial, "queue": []}
        if old_hook:
            for action in old_hook["queue"]:
                hook["state"] = action(hook["state"]) if callable(action) else action

        def set_state(action):
            hook["queue"].append(action)
            self._wip_root = Fiber(
                vnode=self._current_root.vnode, dom=self._current_root.dom,
                alternate=self._current_root,
            )
            self._deletions = []
            self._perform_work(self._wip_root)
            self._commit_root()

        if fiber: fiber.hooks.append(hook)
        self._hook_index += 1
        return hook["state"], set_state

    def use_effect(self, callback: Callable, deps: list):
        self._pending_effects.append((callback, deps))

    # work loop --------------------------------------------------------------

    def _perform_work(self, fiber: Fiber):
        stack = [fiber]
        while stack:
            f = stack.pop()
            self._begin_work(f)
            if f.child: stack.append(f.child)
            if f.sibling: stack.append(f.sibling)

    def _begin_work(self, fiber: Fiber):
        if callable(fiber.vnode.type):
            self._wip_fiber = fiber
            self._hook_index = 0
            fiber.hooks = []
            children = fiber.vnode.type(fiber.vnode.props)
            self._reconcile_children(fiber, children if isinstance(children, list) else [children])
        else:
            if fiber.dom is None and fiber.vnode.type != "ROOT":
                fiber.dom = _create_dom(fiber.vnode)
            raw = fiber.vnode.props.get("children", [])
            self._reconcile_children(fiber, [
                _text_vnode(c) if not isinstance(c, VNode) else c for c in raw
            ])

    def _reconcile_children(self, fiber: Fiber, children: list):
        old = fiber.alternate.child if fiber.alternate else None
        prev: Optional[Fiber] = None
        for i, vnode in enumerate(children):
            same = old and vnode and old.vnode.type == vnode.type
            nf = None
            if same:
                nf = Fiber(vnode=vnode, dom=old.dom, parent=fiber, alternate=old, effect_tag="UPDATE")
            elif vnode:
                nf = Fiber(vnode=vnode, parent=fiber, effect_tag="PLACEMENT")
            if old and not same:
                old.effect_tag = "DELETION"
                self._deletions.append(old)
            if old: old = old.sibling
            if i == 0: fiber.child = nf
            elif nf and prev: prev.sibling = nf
            prev = nf

    # commit -----------------------------------------------------------------

    def _commit_root(self):
        for f in self._deletions: self._commit_deletion(f)
        if self._wip_root and self._wip_root.child:
            self._commit_work(self._wip_root.child)
        self._current_root = self._wip_root
        self._wip_root = None
        for cb, _ in self._pending_effects: cb()
        self._pending_effects.clear()

    def _dom_parent(self, fiber: Fiber) -> Optional[DOMNode]:
        p = fiber.parent
        while p and not isinstance(p.dom, DOMNode): p = p.parent
        return p.dom if p else None

    def _commit_deletion(self, fiber: Fiber):
        if fiber.dom:
            parent = self._dom_parent(fiber)
            if parent and isinstance(fiber.dom, DOMNode): parent.remove(fiber.dom)
        elif fiber.child:
            self._commit_deletion(fiber.child)

    def _commit_work(self, fiber: Fiber):
        parent = self._dom_parent(fiber)
        if fiber.effect_tag == "PLACEMENT" and fiber.dom is not None and parent:
            parent.append(fiber.dom)
        elif fiber.effect_tag == "UPDATE" and parent:
            if isinstance(fiber.dom, DOMNode):
                old_props = fiber.alternate.vnode.props if fiber.alternate else {}
                fiber.dom.update_props(fiber.vnode.props, old_props)
            elif fiber.vnode.type == "TEXT":
                # replace old text string with new one in parent.children
                new_text = str(fiber.vnode.props.get("nodeValue", ""))
                fiber.dom = new_text
                old_text = fiber.alternate.dom if fiber.alternate else None
                if old_text in parent.children:
                    idx = parent.children.index(old_text)
                    parent.children[idx] = new_text
        if fiber.child: self._commit_work(fiber.child)
        if fiber.sibling: self._commit_work(fiber.sibling)

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

_renderer = Renderer()

def use_state(initial: Any):   return _renderer.use_state(initial)
def use_effect(cb: Callable, deps: list = None): _renderer.use_effect(cb, deps or [])
def render(vnode: VNode, container: DOMNode):    _renderer.render(vnode, container)
