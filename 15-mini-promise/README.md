# 15-mini-promise

A Promise/A+ compliant implementation written from scratch in TypeScript.

## Features

- ✅ **Promise/A+ spec** — state machine, async handlers, resolution procedure
- ✅ **`then` / `catch` / `finally`** — full chaining support
- ✅ **`Promise.resolve` / `reject`** — static factory methods
- ✅ **`Promise.all`** — waits for all, fails fast
- ✅ **`Promise.race`** — first settled wins
- ✅ **`Promise.allSettled`** — never rejects, returns status for each
- ✅ **`Promise.any`** — first fulfilled wins, AggregateError if all fail
- ✅ **Chaining cycle detection** — throws TypeError on circular chains
- ✅ **Thenable assimilation** — works with any `.then`-able object

## Usage

```typescript
import { MiniPromise } from './src/index';

// Basic resolve/reject
const p = new MiniPromise<number>((resolve, reject) => {
  setTimeout(() => resolve(42), 100);
});

// Chaining
p.then((v) => v * 2)
 .then((v) => console.log(v))  // 84
 .catch((e) => console.error(e));

// Static helpers
MiniPromise.all([
  MiniPromise.resolve(1),
  MiniPromise.resolve(2),
  MiniPromise.resolve(3),
]).then(console.log); // [1, 2, 3]

MiniPromise.race([
  new MiniPromise((res) => setTimeout(() => res('slow'), 200)),
  new MiniPromise((res) => setTimeout(() => res('fast'), 50)),
]).then(console.log); // 'fast'
```

## How It Works

### State Machine

A promise has three states: **pending → fulfilled** or **pending → rejected**. Once settled, the state never changes.

```
pending ──resolve──► fulfilled
   └───reject───► rejected
```

### Resolution Procedure (2.3)

The core of Promise/A+: when `then` returns a value `x`:

1. If `x === promise2` → throw `TypeError` (cycle detection)
2. If `x` is a thenable (has `.then`) → adopt its state
3. Otherwise → fulfill with `x`

This allows interoperability between different promise implementations.

### Asynchronous Handlers

All `.then` callbacks are scheduled via `queueMicrotask()`, matching the behavior of native Promises (microtask queue, not macrotask).

### Handler Queue

While pending, handlers accumulate in a queue. On settlement, all queued handlers are flushed asynchronously. Handlers added after settlement are also run asynchronously.

## Project Structure

```
15-mini-promise/
├── src/
│   └── index.ts          # MiniPromise implementation
├── __tests__/
│   └── promise.test.ts   # 40+ tests covering all features
├── package.json
├── tsconfig.json
└── README.md
```

## Running Tests

```bash
npm install
npm test
```

## Key Differences from Native Promise

| Feature | MiniPromise | Native Promise |
|---------|-------------|----------------|
| Promise/A+ | ✅ | ✅ |
| Microtask scheduling | ✅ (queueMicrotask) | ✅ |
| Thenable assimilation | ✅ | ✅ |
| `allSettled` / `any` | ✅ | ✅ |
| Unhandled rejection tracking | ❌ | ✅ |
| `Symbol.toStringTag` | ❌ | ✅ |
| Native engine optimization | ❌ | ✅ |

## References

- [Promises/A+ Specification](https://promisesaplus.com/)
- [MDN: Using Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises)
- [Jake Archibald: Tasks, microtasks, queues and schedules](https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/)
