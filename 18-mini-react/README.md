# 18-mini-react

A simplified React implementation in TypeScript (~300 LoC).

## Features

| Feature | Details |
|---|---|
| `createElement` | Build virtual DOM trees |
| `render` | Mount VNode trees into real DOM |
| Function components | Stateless & stateful components |
| `useState` | Local state with batched async re-renders |
| `useEffect` | Side-effects with dependency tracking & cleanup |
| Diff algorithm | Patch DOM in-place; add / remove / replace / patch |

## Architecture

```
VNode tree
    │
    ▼
resolveVNode()     ← calls function components, runs hooks
    │
    ▼
diff()             ← compares prev/next VNode trees
    │
    ▼
DOM mutations      ← createDOMNode / applyProps / replaceChild …
    │
    ▼
flushEffects()     ← runs pending useEffect callbacks
```

### Key design choices

* **Hooks per component key** – each function reference gets its own `HookState` (states array + effects array). Indices are reset on every render, mirroring React's rules of hooks.
* **Microtask batching** – `setState` calls schedule a single `Promise.resolve()` rerender, so multiple state updates in one tick are batched.
* **Keyed-free diff** – children are diffed positionally (index-based), keeping the algorithm simple while still handling add/remove/replace correctly.
* **Text vnodes** – string/number children are wrapped as `{ type: '__text__' }` vnodes so the diff can handle them uniformly.

## Usage

```ts
import MiniReact, { useState, useEffect } from './src';

const { createElement, render } = MiniReact;

function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    document.title = `Count: ${count}`;
  }, [count]);

  return createElement('div', null,
    createElement('p', null, `Count: ${count}`),
    createElement('button', { onClick: () => setCount(c => c + 1) }, '+1'),
  );
}

render(createElement(Counter, null), document.getElementById('root')!);
```

## Running Tests

```bash
npm install
npm test
```

## Project Structure

```
18-mini-react/
├── src/
│   └── index.ts          # Core implementation
├── __tests__/
│   └── react.test.ts     # Jest test suite
├── package.json
├── tsconfig.json
└── README.md
```
