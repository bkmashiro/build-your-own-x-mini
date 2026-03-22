# 14 · Mini Event Loop

> A simplified but faithful simulation of the JavaScript Event Loop in TypeScript.

## What It Demonstrates

The JS event loop is the engine behind JavaScript's non-blocking concurrency model.
This project implements its core mechanics from scratch:

| Component | Description |
|-----------|-------------|
| **Macrotask Queue** | Holds `setTimeout`, `setInterval`, and `setImmediate` callbacks |
| **Microtask Queue** | Holds `Promise.then`-style callbacks (highest priority) |
| **Virtual Clock** | Simulates passage of time so delays work deterministically in tests |
| **Execution Trace** | Pretty-prints each task as it runs, with type and virtual timestamp |

## Execution Order (per tick)

```
┌─────────────────────────────────────┐
│ 1. Run current macrotask            │
│ 2. Drain ALL microtasks             │  ← repeats if microtasks enqueue more
│    (including newly added ones)     │
│ 3. Pick next eligible macrotask     │
│    (setImmediate > setTimeout(0)    │
│     > later timeouts)               │
└─────────────────────────────────────┘
```

### Priority Rules

1. **Microtasks** always run before any macrotask
2. Among macrotasks at the same virtual time: **setImmediate** > **setTimeout/setInterval**
3. Microtasks queued *inside* a macrotask run **before the next macrotask**, not at the end

## API

```ts
const loop = new EventLoop({ verbose: true });

// Schedule once after delay (ms)
const id = loop.setTimeout(fn, 100, "label");
loop.clearTimeout(id);

// Repeat every interval (ms)
const iid = loop.setInterval(fn, 50, "label");
loop.clearInterval(iid);

// Run in the next loop iteration (before timers)
loop.setImmediate(fn, "label");

// Enqueue a microtask (Promise.then equivalent)
loop.queueMicrotask(fn, "label");

// Thenable helper (resolves after delay, .then() → microtask)
loop.resolvedPromise(0).then(() => { /* ... */ });

// Run until the queue is empty
loop.run();

// Inspect execution history
loop.log; // ExecutionRecord[]
```

## Getting Started

```bash
npm install
npm test          # run test suite
npx ts-node src/index.ts   # run the built-in demo
```

## Demo Output

```
╔══════════════════════════════════════════════════════╗
║           Mini Event Loop — Execution Trace           ║
╚══════════════════════════════════════════════════════╝
Step   T(ms)    Type           Label
────────────────────────────────────────────────────────
[1]    +0ms     microtask      early microtask
[2]    +0ms     setImmediate   setImmediate
[3]    +0ms     setTimeout     setTimeout(0ms)
[4]    +0ms     microtask      inner microtask
[5]    +50ms    setInterval    setInterval(50ms)
[6]    +100ms   setTimeout     setTimeout(100ms)
[7]    +100ms   setInterval    setInterval(50ms)
[8]    +150ms   setInterval    setInterval(50ms)
[9]    +175ms   setTimeout     clearInterval at 175ms
────────────────────────────────────────────────────────
✓ Done — 9 tasks executed, virtual time: +175ms
```

## Key Concepts

### Why microtasks run first

Microtasks represent "the current work isn't done yet" — e.g., a resolved Promise
continuation. The spec mandates they flush completely before yielding back to the
event loop to pick up the next I/O or timer callback.

### setImmediate vs setTimeout(0)

`setImmediate` was designed to fire "at the top of the next iteration" — before
timers that were scheduled to fire at the same moment. In Node.js, this ordering
can vary depending on where in the loop you call them; our simulation models the
common case where `setImmediate` wins on a tie.

### Virtual time

Instead of `Date.now()`, we keep a `virtualTime` counter that jumps to the
`dueAt` of each macrotask. This makes tests fully deterministic and instant —
no `await sleep(...)` needed.

## Project Structure

```
14-mini-event-loop/
├── src/
│   └── index.ts          # EventLoop class + demo
├── __tests__/
│   └── event-loop.test.ts
├── package.json
├── tsconfig.json
└── README.md
```
