/**
 * 20-mini-fiber
 *
 * A simplified React Fiber-inspired scheduler implementing:
 * - Fiber node data structure
 * - Priority-based scheduling (Lane model)
 * - Time slicing via requestIdleCallback simulation
 * - Interruptible work loop
 * - Cooperative multitasking
 */

// ─── Priority / Lane Model ────────────────────────────────────────────────────

export const enum Priority {
  /** Synchronous — must finish in the same tick (e.g., user input) */
  Immediate = 1,
  /** High — user-visible interaction, short deadline (~250 ms) */
  UserBlocking = 2,
  /** Normal — default async work (~5 s) */
  Normal = 3,
  /** Low — prefetch / analytics (~10 s) */
  Low = 4,
  /** Idle — runs only when nothing else is pending */
  Idle = 5,
}

/** Timeout (ms) assigned to each priority level */
const PRIORITY_TIMEOUTS: Record<Priority, number> = {
  [Priority.Immediate]: -1,       // no timeout — synchronous
  [Priority.UserBlocking]: 250,
  [Priority.Normal]: 5_000,
  [Priority.Low]: 10_000,
  [Priority.Idle]: Infinity,
};

// ─── Fiber Flags ──────────────────────────────────────────────────────────────

export const enum FiberFlag {
  NoFlags   = 0b0000,
  Placement = 0b0001,   // needs mount
  Update    = 0b0010,   // needs update
  Deletion  = 0b0100,   // needs unmount
}

// ─── Fiber Node ───────────────────────────────────────────────────────────────

export interface FiberNode<T = unknown> {
  /** Unique id for identification */
  id: string;
  /** Arbitrary payload / props */
  data: T;
  /** Effect flags */
  flags: FiberFlag;
  /** Priority of this unit of work */
  priority: Priority;
  /** Linked list: first child */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  child: FiberNode<any> | null;
  /** Linked list: next sibling */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sibling: FiberNode<any> | null;
  /** Back-pointer to parent */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return: FiberNode<any> | null;
  /** The work function for this fiber — returns pending child work */
  work: ((fiber: FiberNode<T>) => void) | null;
  /** Whether this fiber has been processed */
  completed: boolean;
}

export function createFiber<T>(
  id: string,
  data: T,
  priority: Priority = Priority.Normal,
  work?: (fiber: FiberNode<T>) => void,
): FiberNode<T> {
  return {
    id,
    data,
    flags: FiberFlag.Placement,
    priority,
    child: null,
    sibling: null,
    return: null,
    work: work ?? null,
    completed: false,
  };
}

// ─── Idle Deadline Simulation ─────────────────────────────────────────────────

/**
 * Simulates the `IdleDeadline` object passed by `requestIdleCallback`.
 * In a browser environment you'd use the real API; here we model it with
 * `performance.now()` (or `Date.now()` as fallback).
 */
export interface IdleDeadline {
  /** Returns `true` when the available time has run out. */
  didTimeout: boolean;
  /** Milliseconds remaining in the current idle period. */
  timeRemaining(): number;
}

const now = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

export function createDeadline(frameMs: number, didTimeout = false): IdleDeadline {
  const deadline = now() + frameMs;
  return {
    didTimeout,
    timeRemaining() {
      return Math.max(0, deadline - now());
    },
  };
}

// ─── Task Queue (min-heap by expirationTime) ──────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFiberNode = FiberNode<any>;

interface SchedulerTask {
  id: number;
  fiber: AnyFiberNode;
  expirationTime: number;
  startTime: number;
}

let taskIdCounter = 0;

function taskComparator(a: SchedulerTask, b: SchedulerTask): number {
  // Earlier expiration = higher urgency
  if (a.expirationTime !== b.expirationTime) return a.expirationTime - b.expirationTime;
  return a.id - b.id;
}

class MinHeap<T> {
  private heap: T[] = [];

  constructor(private compare: (a: T, b: T) => number) {}

  push(item: T): void {
    this.heap.push(item);
    this._siftUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  peek(): T | undefined {
    return this.heap[0];
  }

  get size(): number {
    return this.heap.length;
  }

  private _siftUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.heap[i], this.heap[parent]) < 0) {
        [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
        i = parent;
      } else break;
    }
  }

  private _siftDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.compare(this.heap[l], this.heap[smallest]) < 0) smallest = l;
      if (r < n && this.compare(this.heap[r], this.heap[smallest]) < 0) smallest = r;
      if (smallest !== i) {
        [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
        i = smallest;
      } else break;
    }
  }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

/**
 * FiberScheduler orchestrates fiber work:
 *
 * 1. `schedule(fiber)` — enqueues a fiber with a computed expiration time.
 * 2. `workLoop(deadline)` — processes fibers within the given idle window;
 *    yields back to the caller when time runs out (interruptible).
 * 3. `flush(frameMs?)` — convenience: runs `workLoop` repeatedly until queue
 *    is empty (useful in tests / Node.js where there's no real idle callback).
 */
export class FiberScheduler {
  private taskQueue = new MinHeap<SchedulerTask>(taskComparator);
  /** Effect list — fibers that completed and need commit */
  public effectList: AnyFiberNode[] = [];
  /** Whether the scheduler is currently inside a work loop */
  private isWorking = false;
  /** Stats for introspection */
  public stats = { scheduled: 0, completed: 0, interrupted: 0 };

  /** Schedule a fiber for processing. */
  schedule(fiber: AnyFiberNode): void {
    const startTime = now();
    const timeout = PRIORITY_TIMEOUTS[fiber.priority];
    const expirationTime = timeout === Infinity ? Infinity : startTime + timeout;

    const task: SchedulerTask = {
      id: ++taskIdCounter,
      fiber,
      expirationTime,
      startTime,
    };

    this.taskQueue.push(task);
    this.stats.scheduled++;
  }

  /**
   * Work loop — processes units of work while deadline permits.
   * Mirrors React's `workLoopConcurrent`.
   *
   * @returns `true` if all work is done, `false` if interrupted.
   */
  workLoop(deadline: IdleDeadline): boolean {
    this.isWorking = true;

    while (this.taskQueue.size > 0) {
      const task = this.taskQueue.peek()!;

      // Yield if time is up AND the task hasn't expired (not urgent)
      const hasTimeLeft = deadline.timeRemaining() > 0;
      const isExpired = task.expirationTime <= now();

      if (!hasTimeLeft && !isExpired && !deadline.didTimeout) {
        // Interrupted — yield back to host
        this.isWorking = false;
        this.stats.interrupted++;
        return false;
      }

      // Dequeue and process
      this.taskQueue.pop();
      this._performWork(task.fiber);
    }

    this.isWorking = false;
    return true;
  }

  /**
   * Flush all queued work synchronously (useful in tests / Node.js).
   *
   * @param frameMs - simulated idle frame size in ms (default 16)
   */
  flush(frameMs = 16): void {
    while (this.taskQueue.size > 0) {
      const deadline = createDeadline(frameMs);
      this.workLoop(deadline);
    }
  }

  /** Process a single fiber and traverse its subtree depth-first. */
  private _performWork(fiber: AnyFiberNode): void {
    // Execute the fiber's own work unit
    if (fiber.work && !fiber.completed) {
      fiber.work(fiber);
    }
    fiber.completed = true;
    fiber.flags = (fiber.flags & ~FiberFlag.Placement) | FiberFlag.Update;
    this.effectList.push(fiber);
    this.stats.completed++;

    // Schedule children
    let child = fiber.child;
    while (child) {
      child.return = fiber;
      this.schedule(child);
      child = child.sibling;
    }
  }

  /** Commit all effects in effect list (analogous to React's commit phase). */
  commit(onCommit?: (fiber: AnyFiberNode) => void): void {
    for (const fiber of this.effectList) {
      onCommit?.(fiber);
    }
    this.effectList = [];
  }

  get hasPendingWork(): boolean {
    return this.taskQueue.size > 0;
  }
}

// ─── High-level helpers ───────────────────────────────────────────────────────

/**
 * Build a fiber tree from a plain nested description.
 *
 * ```ts
 * const tree = buildFiberTree({
 *   id: 'root', data: 'App',
 *   children: [
 *     { id: 'h1', data: 'Title' },
 *     { id: 'p',  data: 'Body' },
 *   ],
 * });
 * ```
 */
export interface FiberTreeDesc<T = unknown> {
  id: string;
  data: T;
  priority?: Priority;
  work?: (fiber: FiberNode<T>) => void;
  children?: FiberTreeDesc<T>[];
}

export function buildFiberTree<T>(desc: FiberTreeDesc<T>): FiberNode<T> {
  const fiber = createFiber(desc.id, desc.data, desc.priority ?? Priority.Normal, desc.work);

  if (desc.children && desc.children.length > 0) {
    const childFibers = desc.children.map(c => buildFiberTree(c));
    // Wire sibling linked list
    for (let i = 0; i < childFibers.length - 1; i++) {
      childFibers[i].sibling = childFibers[i + 1];
    }
    fiber.child = childFibers[0];
    // Set return pointer
    for (const cf of childFibers) cf.return = fiber;
  }

  return fiber;
}

/**
 * Traverse a fiber tree in DFS order, yielding each node.
 * Useful for assertions in tests.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function* traverseFiber(root: FiberNode<any>): Generator<FiberNode<any>> {
  yield root;
  let child = root.child;
  while (child) {
    yield* traverseFiber(child);
    child = child.sibling;
  }
}
