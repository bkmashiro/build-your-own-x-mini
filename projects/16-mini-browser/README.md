# mini-browser

> A tiny terminal browser in Python: HTML tokenization, CSS rule matching, box-model layout, and text painting.

[中文](README.zh.md)

---

## Background

Browsers are a pipeline:

- tokenize markup
- build a tree
- attach CSS rules
- compute boxes
- paint pixels

This project compresses that idea into a tiny renderer that paints characters instead of pixels. It is not a full browser. It is just enough to make the render tree and layout pipeline visible.

---

## Architecture

```text
HTML
  -> tokenizer
  -> DOM tree
  -> CSS parser
  -> style matching
  -> block layout
  -> terminal canvas
```

Supported pieces:

- HTML start tags, end tags, text nodes, and `<style>`
- CSS tag selectors, `.class`, `#id`
- `width`, `height`, `margin`, `padding`, `border`
- vertical block layout
- ASCII border painting and wrapped text

---

## Key Implementation

### HTML tokenizer

`tokenize_html()` splits the source into tags and text chunks with one regex. `parse_html()` then uses a stack to build a tiny DOM.

### CSS matching

`parse_css()` reads `selector { prop: value }` pairs. Each node receives merged declarations from matching rules. Selectors are intentionally limited to tag, class, and id.

### Box model and layout

Each element computes:

- margin
- border
- padding
- inner width
- stacked child height

Children are laid out top-to-bottom, similar to normal block flow in a browser.

### Terminal paint

Instead of a pixel framebuffer, the renderer allocates a 2D character canvas. Borders use `+`, `-`, and `|`, while text is wrapped into the available content width.

---

## How to Run

```bash
python projects/16-mini-browser/demo.py
```

The demo renders a boxed card into terminal text.

---

## What This Omits

- inline layout and line boxes
- selector specificity and cascading order details
- colors, fonts, and ANSI styling
- scrolling, events, JavaScript, networking

Those are large subsystems. The goal here is the render pipeline, not standards compliance.
