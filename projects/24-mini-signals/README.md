# mini-signals

> A Solid.js-style reactive core in small TypeScript: signals, effects, memos, and batched updates.

[中文](README.zh.md)

---

## Background

Signals-based reactivity flips the usual "re-render everything" model on its head:

- `createSignal` stores a value and tracks who reads it
- `createEffect` reruns only when one of its tracked reads changes
- `createMemo` caches derived state and fans updates out to downstream effects
- `batch` groups multiple writes into a single flush

Solid.js popularized this model in frontend frameworks, but the core runtime is much smaller than most people expect. Once you have dependency tracking, cleanup, and a scheduler, the rest is mostly API shape.

---

## Architecture

```
Signal write
   │
   ▼
notify observers
   │
   ▼
queue computations
   │
   ▼
flush scheduler
   ├── memo  -> recompute -> notify downstream if value changed
   └── effect -> rerun side effect with fresh dependency tracking
```

Every computation keeps a set of sources it touched last run. Before rerunning, it unsubscribes from those sources, executes again under a global `currentComputation`, and rebuilds its dependency graph from scratch. That single cleanup step is what makes branch switching work correctly.

---

## Key Implementation

### Automatic dependency tracking

When a signal or memo getter runs, it checks whether a computation is currently executing:

```ts
function track(source: Source): void {
  if (!currentComputation || currentComputation.sources.has(source)) return;
  currentComputation.sources.add(source);
  source.observers.add(currentComputation);
}
```

That is enough to wire the graph automatically without explicit dependency arrays.

### Scheduler + memo shielding

Signal writes do not rerun effects immediately. They enqueue dependent computations:

- effects rerun once per flush, even if multiple dependencies changed
- memos recompute first
- downstream observers are notified only if the memo value actually changed

That last rule avoids redundant effect runs for stable derived values.

### Batching

`batch()` increments a depth counter. Writes inside a batch only enqueue work; the queue flushes when the outermost batch finishes.

This gives the same user-facing behavior as UI frameworks that collapse multiple state updates into one reaction pass.

---

## How to Run

```bash
npm test
npm run demo
```

The tests use Node 25's `--experimental-strip-types`, so no extra TypeScript toolchain is required.

---

## What This Omits

- async resources / transitions
- cleanup callbacks (`onCleanup`)
- error boundaries
- owner trees and disposal

Those features matter in production runtimes, but they are not required to understand the core mechanics of signals-based reactivity.
