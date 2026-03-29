"""mini-browser - tiny HTML/CSS layout engine that paints to the terminal."""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class Node:
    tag: str
    attrs: dict[str, str] = field(default_factory=dict)
    text: str = ""
    children: list["Node"] = field(default_factory=list)
    style: dict[str, int | str] = field(default_factory=dict)
    box: tuple[int, int, int, int] = (0, 0, 0, 0)


def tokenize_html(html: str) -> list[str]:
    return [t for t in re.findall(r"<[^>]+>|[^<]+", html) if t.strip()]


def parse_html(html: str) -> tuple[Node, str]:
    root, stack, css = Node("document"), [], ""
    stack.append(root)
    for token in tokenize_html(html):
        if token.startswith("</"):
            if len(stack) > 1:
                stack.pop()
            continue
        if token.startswith("<"):
            body = token[1:-1].strip()
            if body.endswith("/"):
                body = body[:-1].strip()
            parts = body.split(None, 1)
            tag = parts[0].lower()
            attrs = dict(re.findall(r'(\w+)="([^"]*)"', parts[1] if len(parts) > 1 else ""))
            node = Node(tag, attrs)
            stack[-1].children.append(node)
            if tag == "style":
                stack.append(node)
            elif tag not in {"br", "meta", "img", "link", "hr", "input"} and not token.endswith("/>"):
                stack.append(node)
            continue
        text = " ".join(token.split())
        if not text:
            continue
        if stack[-1].tag == "style":
            css += text + "\n"
        else:
            stack[-1].children.append(Node("text", text=text))
    return root, css


def parse_css(css: str) -> list[tuple[str, dict[str, int | str]]]:
    rules = []
    for selector, body in re.findall(r"([^{}]+)\{([^{}]+)\}", css):
        props = {}
        for name, value in re.findall(r"([\w-]+)\s*:\s*([^;]+)", body):
            value = value.strip()
            props[name.strip()] = int(value[:-2]) if value.endswith("px") and value[:-2].isdigit() else value
        rules.append((selector.strip(), props))
    return rules


def matches(node: Node, selector: str) -> bool:
    if selector.startswith("."):
        return selector[1:] in node.attrs.get("class", "").split()
    if selector.startswith("#"):
        return node.attrs.get("id") == selector[1:]
    return node.tag == selector


def compute_styles(node: Node, rules: list[tuple[str, dict[str, int | str]]]) -> None:
    defaults = {"display": "block", "margin": 0, "padding": 0, "border": 0}
    node.style = defaults | {k: v for s, p in rules if matches(node, s) for k, v in p.items()}
    for child in node.children:
        compute_styles(child, rules)


def lines(text: str, width: int) -> list[str]:
    words, out, line = text.split(), [], ""
    for word in words or [""]:
        trial = word if not line else f"{line} {word}"
        if len(trial) <= width:
            line = trial
        else:
            out.append(line)
            line = word[:width]
    return out + ([line] if line else [])


def layout(node: Node, x: int, y: int, width: int) -> int:
    if node.tag == "text":
        node.box = (x, y, width, len(lines(node.text, max(1, width))))
        return node.box[3]
    s = node.style
    m, p, b = (int(s.get(k, 0)) for k in ("margin", "padding", "border"))
    inner_w = max(8, min(int(s.get("width", width - 2 * (m + p + b))), width - 2 * (m + p + b)))
    cur_y = y + m + b + p
    child_x = x + m + b + p
    for child in node.children:
        cur_y += layout(child, child_x, cur_y, inner_w)
    content_h = max(int(s.get("height", 0)), cur_y - (y + m + b + p))
    total_h = content_h + 2 * (m + p + b)
    node.box = (x + m, y + m, inner_w + 2 * (p + b), total_h - 2 * m)
    return total_h


def paint_text(canvas: list[list[str]], x: int, y: int, width: int, text: str) -> None:
    for dy, line in enumerate(lines(text, max(1, width))):
        for dx, ch in enumerate(line[:width]):
            if 0 <= y + dy < len(canvas) and 0 <= x + dx < len(canvas[0]):
                canvas[y + dy][x + dx] = ch


def paint_box(canvas: list[list[str]], box: tuple[int, int, int, int], border: int) -> None:
    x, y, w, h = box
    if border <= 0 or w < 2 or h < 2:
        return
    for i in range(x, min(x + w, len(canvas[0]))):
        if 0 <= y < len(canvas):
            canvas[y][i] = "-"
        if 0 <= y + h - 1 < len(canvas):
            canvas[y + h - 1][i] = "-"
    for j in range(y, min(y + h, len(canvas))):
        if 0 <= x < len(canvas[0]):
            canvas[j][x] = "|"
        if 0 <= x + w - 1 < len(canvas[0]):
            canvas[j][x + w - 1] = "|"
    for px, py in ((x, y), (x + w - 1, y), (x, y + h - 1), (x + w - 1, y + h - 1)):
        if 0 <= py < len(canvas) and 0 <= px < len(canvas[0]):
            canvas[py][px] = "+"


def paint(node: Node, canvas: list[list[str]]) -> None:
    if node.tag == "text":
        paint_text(canvas, node.box[0], node.box[1], node.box[2], node.text)
        return
    paint_box(canvas, node.box, int(node.style.get("border", 0)))
    x, y, _, _ = node.box
    offset = int(node.style.get("padding", 0)) + int(node.style.get("border", 0))
    for child in node.children:
        if child.tag == "text":
            paint_text(canvas, x + offset, child.box[1], child.box[2], child.text)
        else:
            paint(child, canvas)


def render(html: str, viewport: tuple[int, int] = (72, 28)) -> str:
    dom, css = parse_html(html)
    rules = parse_css(css)
    compute_styles(dom, rules)
    body = next((n for n in dom.children if n.tag == "html"), dom)
    if body.tag == "html":
        body = next((n for n in body.children if n.tag == "body"), body)
    layout(body, 0, 0, viewport[0])
    canvas = [[" " for _ in range(viewport[0])] for _ in range(max(viewport[1], body.box[3] + 2))]
    paint(body, canvas)
    return "\n".join("".join(row).rstrip() for row in canvas).rstrip()
