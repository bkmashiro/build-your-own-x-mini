from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Match:
    text: str
    spans: dict[int, tuple[int | None, int | None]]
    def group(self, n: int = 0) -> str | None:
        a, b = self.spans.get(n, (None, None)); return None if a is None or b is None else self.text[a:b]
    def groups(self) -> tuple[str | None, ...]:
        return tuple(self.group(i) for i in range(1, max(self.spans, default=0) + 1))
    def span(self, n: int = 0) -> tuple[int | None, int | None]: return self.spans.get(n, (None, None))


class Parser:
    def __init__(self, pattern: str):
        self.p, self.i, self.groups = pattern, 0, 0

    def parse(self):
        node = self.expr()
        if self.i != len(self.p): raise ValueError(f"unexpected token at {self.i}: {self.p[self.i]!r}")
        return node, self.groups

    def expr(self):
        node = self.concat()
        while self.peek("|"):
            self.i += 1
            node = ("or", node, self.concat())
        return node

    def concat(self):
        nodes = []
        while self.i < len(self.p) and self.p[self.i] not in "|)": nodes.append(self.repeat())
        if not nodes: return ("eps",)
        node = nodes[0]
        for nxt in nodes[1:]: node = ("cat", node, nxt)
        return node

    def repeat(self):
        node = self.atom()
        while self.i < len(self.p) and self.p[self.i] in "*+?":
            node, self.i = (self.p[self.i], node), self.i + 1
        return node

    def atom(self):
        if self.peek("("):
            self.i += 1
            self.groups += 1
            node = ("group", self.groups, self.expr())
            self.need(")")
            return node
        if self.peek("["):
            self.i += 1
            chars = []
            while not self.peek("]"): chars.append(self.char("]"))
            self.need("]")
            return ("class", frozenset(chars))
        if self.peek("."): self.i += 1; return ("dot",)
        if self.peek("^"): self.i += 1; return ("bol",)
        if self.peek("$"): self.i += 1; return ("eol",)
        return ("lit", self.char())

    def char(self, stop: str = ""):
        if self.i >= len(self.p): raise ValueError("unexpected end of pattern")
        ch = self.p[self.i]; self.i += 1
        if ch == "\\":
            if self.i >= len(self.p): raise ValueError("dangling escape")
            ch, self.i = self.p[self.i], self.i + 1
        elif stop and ch == stop:
            raise ValueError(f"expected character before {stop!r}")
        return ch

    def peek(self, ch: str) -> bool: return self.i < len(self.p) and self.p[self.i] == ch
    def need(self, ch: str):
        if not self.peek(ch): raise ValueError(f"expected {ch!r}")
        self.i += 1


class Regex:
    def __init__(self, pattern: str):
        tree, self.group_count = Parser(pattern).parse()
        self.states: list[list[tuple[str, object, int, tuple[str, int] | None]]] = []
        self.start, self.end = self.build(tree)

    def new(self):
        self.states.append([])
        return len(self.states) - 1

    def edge(self, src, kind, arg, dst, action=None): self.states[src].append((kind, arg, dst, action))

    def build(self, node):
        kind = node[0]
        if kind == "eps":
            a, b = self.new(), self.new()
            self.edge(a, "eps", None, b)
            return a, b
        if kind in {"lit", "class", "dot", "bol", "eol"}:
            a, b = self.new(), self.new()
            self.edge(a, kind, node[1] if len(node) > 1 else None, b)
            return a, b
        if kind == "cat":
            a1, z1 = self.build(node[1]); a2, z2 = self.build(node[2])
            self.edge(z1, "eps", None, a2)
            return a1, z2
        if kind == "or":
            a, z = self.new(), self.new()
            for part in node[1:]:
                x, y = self.build(part)
                self.edge(a, "eps", None, x); self.edge(y, "eps", None, z)
            return a, z
        if kind in {"*", "+", "?"}:
            a, z = self.new(), self.new()
            x, y = self.build(node[1])
            if kind != "+": self.edge(a, "eps", None, z)
            self.edge(a, "eps", None, x); self.edge(y, "eps", None, z)
            if kind != "?": self.edge(y, "eps", None, x)
            return a, z
        if kind == "group":
            a, z = self.new(), self.new()
            x, y = self.build(node[2])
            self.edge(a, "eps", None, x, ("start", node[1]))
            self.edge(y, "eps", None, z, ("end", node[1]))
            return a, z
        raise ValueError(f"unknown node: {kind}")

    def closure(self, items, pos, text):
        stack, out, seen = list(items), [], set()
        while stack:
            state, spans = stack.pop()
            key = (state, tuple(sorted(spans.items())))
            if key in seen: continue
            seen.add(key); out.append((state, spans))
            for kind, _, dst, action in self.states[state]:
                if kind == "eps" or (kind == "bol" and pos == 0) or (kind == "eol" and pos == len(text)):
                    nxt = dict(spans)
                    if action:
                        start, end = nxt.get(action[1], (None, None))
                        nxt[action[1]] = (pos, end) if action[0] == "start" else (start, pos)
                    stack.append((dst, nxt))
        return out

    def run(self, text: str, starts, full: bool = False):
        for i in starts:
            best = None
            curr = self.closure([(self.start, {0: (i, None)})], i, text)
            for pos in range(i, len(text) + 1):
                for state, spans in curr:
                    if state == self.end and (not full or pos == len(text)):
                        spans = dict(spans); spans[0] = (i, pos); best = Match(text, spans)
                if pos == len(text): break
                nxt, ch = [], text[pos]
                for state, spans in curr:
                    for kind, arg, dst, _ in self.states[state]:
                        if (kind == "lit" and ch == arg) or (kind == "class" and ch in arg) or kind == "dot":
                            nxt.append((dst, spans))
                curr = self.closure(nxt, pos + 1, text)
            if best: return best
        return None

    def fullmatch(self, text: str) -> Match | None: return self.run(text, [0], full=True)
    def search(self, text: str) -> Match | None: return self.run(text, range(len(text) + 1))


def compile(pattern: str) -> Regex: return Regex(pattern)
def match(pattern: str, text: str) -> Match | None: return compile(pattern).fullmatch(text)
def search(pattern: str, text: str) -> Match | None: return compile(pattern).search(text)
