# 19-mini-vdom

A minimal Virtual DOM implementation in TypeScript — diff, patch, and keyed list reconciliation from scratch.

## Features

| Feature | Details |
|---|---|
| `h()` | Hyperscript factory — creates VNodes |
| `mount()` | First render: VNode → real DOM |
| `patch()` | Reconcile old/new VNode trees, update real DOM |
| Props diff | Add / remove / update attributes & events |
| Unkeyed diff | Index-based child reconciliation |
| Keyed diff | Key-based reuse with LIS move minimisation |

## Usage

```ts
import { h, mount, patch } from './src/index';

const app = document.getElementById('app')!;

// First render
const v1 = h('ul', null,
  h('li', { key: 'a' }, 'Apple'),
  h('li', { key: 'b' }, 'Banana'),
  h('li', { key: 'c' }, 'Cherry'),
);
mount(v1, app);

// Update — reorders and modifies items
const v2 = h('ul', null,
  h('li', { key: 'c' }, 'Cherry 🍒'),
  h('li', { key: 'a' }, 'Apple 🍎'),
  h('li', { key: 'd' }, 'Date 🌴'),
);
patch(v1, v2, app);
```

## API

### `h(type, props, ...children): VNode`

Creates a virtual DOM node.

- `type` — HTML tag name (`'div'`, `'span'`, …)
- `props` — object of attributes/event handlers; include `key` for keyed lists
- `children` — nested `VNode`s, strings, numbers, or arrays (auto-flattened)

### `mount(vnode, container): void`

Renders a VNode tree into a real DOM container for the first time.

### `patch(oldVNode, newVNode, container): VNode`

Reconciles the new VNode tree against the old one and updates the real DOM in place.
Returns the new VNode (with `_el` references populated).

## Algorithm

### Props Reconciliation

- Iterates over old and new prop sets
- Removes props absent from new tree
- Adds/updates props that changed
- Handles events (`onClick` → `addEventListener('click', …)`)

### Unkeyed Children (index-based)

Simple O(n) pass: patch existing nodes at the same index, mount extras, remove leftovers.

### Keyed Children (key-based)

1. Build a `Map<key, oldVNode>` from the old children
2. For each new child, look up the matching old node by key and patch in-place
3. Remove old nodes with keys that disappeared
4. Mount brand-new nodes (key not in old map)
5. Compute the **Longest Increasing Subsequence** on `newIndex → oldIndex` mapping to identify nodes that are already in order and need no DOM moves
6. Walk new children from right to left, `insertBefore` only nodes not in the LIS

This minimises DOM mutations — nodes already in the right relative order are never moved.

## Running Tests

```bash
npm install
npm test
```

## Project Structure

```
19-mini-vdom/
├── src/
│   └── index.ts          # Core implementation
├── __tests__/
│   └── vdom.test.ts      # Jest test suite
├── package.json
├── tsconfig.json
└── README.md
```
