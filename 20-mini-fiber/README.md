# 20-mini-fiber

A simplified React Fiber-inspired scheduler implemented in TypeScript.

## Concepts

React Fiber is a complete rewrite of React's core algorithm, enabling:

- **Incremental rendering** — split rendering work into chunks
- **Interruptibility** — pause and resume work
- **Priority scheduling** — urgent work preempts less urgent work
- **Concurrency** — keep the UI responsive during expensive renders

This mini-implementation distills those ideas into ~300 lines of clean TypeScript.

---

## Architecture

```
FiberNode          — unit of work (data + links + flags)
FiberScheduler     — orchestrates work via a priority queue
  └─ MinHeap       — O(log n) priority queue (min-heap)
  └─ workLoop()    — time-sliced, interruptible processing
  └─ effectList    — completed fibers awaiting commit
IdleDeadline       — simulates requestIdleCallback deadline
```

### Fiber Node

```ts
interface FiberNode<T> {
  id: string;
  data: T;
  flags: FiberFlag;      // Placement | Update | Deletion
  priority: Priority;    // Immediate → Idle
  child: FiberNode | null;
  sibling: FiberNode | null;
  return: FiberNode | null;
  work: ((f: FiberNode<T>) => void) | null;
  completed: boolean;
}
```

Fibers form a **singly-linked tree**: each node points to its first `child`, its next `sibling`, and its `return` (parent). This structure lets the scheduler walk the tree without recursion and yield at any point.

### Priority Levels

| Priority      | Timeout  | Use case                     |
|---------------|----------|------------------------------|
| Immediate     | sync     | User input, animations       |
| UserBlocking  | 250 ms   | Click handlers               |
| Normal        | 5 s      | Data fetching, routing       |
| Low           | 10 s     | Analytics, logging           |
| Idle          | ∞        | Prefetch, off-screen content |

### Work Loop

```
workLoop(deadline)
├─ peek at highest-priority task
├─ if time remains OR task expired → process it
│   ├─ call fiber.work(fiber)
│   ├─ mark completed, add to effectList
│   └─ schedule children into the queue
└─ if no time remains → yield (return false)
```

The scheduler mimics `requestIdleCallback`: it asks "how much time is left in this frame?" and yields cooperatively so the browser (or host) can handle other work.

---

## Usage

```ts
import { createFiber, FiberScheduler, Priority, buildFiberTree } from './src';

// 1. Create a fiber tree
const root = buildFiberTree({
  id: 'App',
  data: { type: 'div' },
  children: [
    { id: 'Header', data: { type: 'header' } },
    { id: 'Main',   data: { type: 'main'   },
      children: [
        { id: 'Article', data: { type: 'article' } },
      ],
    },
    { id: 'Footer', data: { type: 'footer' } },
  ],
});

// 2. Schedule the root
const scheduler = new FiberScheduler();
scheduler.schedule(root);

// 3. Process with time slicing (in a browser you'd use requestIdleCallback)
function workOnNextFrame(deadline: IdleDeadline) {
  const done = scheduler.workLoop(deadline);
  if (!done) {
    requestIdleCallback(workOnNextFrame); // yield and resume
  } else {
    scheduler.commit(fiber => {
      console.log('committed:', fiber.id);
    });
  }
}
requestIdleCallback(workOnNextFrame);

// 4. Or flush synchronously (useful in Node.js / tests)
scheduler.flush();
scheduler.commit(fiber => console.log('committed:', fiber.id));
```

---

## Key Ideas

### 1. Time Slicing

```ts
while (taskQueue.size > 0) {
  const hasTime = deadline.timeRemaining() > 0;
  const isExpired = task.expirationTime <= now();

  if (!hasTime && !isExpired) {
    return false; // yield to host
  }
  // ... process task
}
```

### 2. Priority via Expiration

Each task's urgency is encoded as an **expiration timestamp**:
`expiration = now() + priorityTimeout`

The min-heap orders by expiration so the most urgent task is always processed first.

### 3. Interruptibility

Work is split into **units** (one fiber per iteration). After each unit, the scheduler checks the deadline. If time is up, it returns `false` and the caller can schedule a resumption in the next idle period.

### 4. Effect List

Completed fibers are appended to `effectList`. After all render work is done, `commit()` applies effects (DOM mutations, side-effects, etc.).

---

## Running

```bash
npm install
npm test
npm run build
```

## Project Structure

```
20-mini-fiber/
├── src/
│   └── index.ts         # Fiber scheduler implementation
├── __tests__/
│   └── fiber.test.ts    # Test suite
├── package.json
├── tsconfig.json
└── README.md
```
