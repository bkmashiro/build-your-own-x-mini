/**
 * Mini Event Loop — Simplified JavaScript Event Loop Simulation
 *
 * Implements the core mechanics of the JS event loop:
 *   1. Call Stack         — synchronous code runs here
 *   2. Microtask Queue    — Promise callbacks (highest priority after each task)
 *   3. Macrotask Queue    — setTimeout / setInterval / setImmediate callbacks
 *
 * Execution order per tick:
 *   [run current task] → [drain microtask queue] → [pick next macrotask]
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type Callback = () => void;

export interface Task {
  id: number;
  type: "setTimeout" | "setInterval" | "setImmediate" | "microtask";
  label: string;
  callback: Callback;
  /** Absolute "time" (in ms) when this task becomes eligible to run */
  dueAt: number;
  /** For setInterval: repeat interval in ms */
  interval?: number;
  /** Whether this task has been cancelled */
  cancelled?: boolean;
  /**
   * For setInterval: the handle returned to the caller (stable across repeats).
   * clearInterval uses this to cancel all future repetitions.
   */
  intervalHandle?: number;
}

export interface ExecutionRecord {
  step: number;
  taskId: number;
  type: Task["type"];
  label: string;
  virtualTime: number;
}

// ─── EventLoop ────────────────────────────────────────────────────────────────

export class EventLoop {
  private macrotaskQueue: Task[] = [];
  private microtaskQueue: Task[] = [];

  private virtualTime = 0; // simulated clock in ms
  private taskIdCounter = 0;
  private stepCounter = 0;

  /** Full execution history — useful for assertions and visualisation */
  readonly log: ExecutionRecord[] = [];

  private verbose: boolean;

  constructor(options: { verbose?: boolean } = {}) {
    this.verbose = options.verbose ?? true;
  }

  // ─── Public API (mirrors browser/Node globals) ──────────────────────────

  /**
   * Schedule a one-shot callback after `delay` ms of virtual time.
   * Returns a handle that can be passed to clearTimeout.
   */
  setTimeout(callback: Callback, delay = 0, label?: string): number {
    const task = this.createTask(
      "setTimeout",
      callback,
      this.virtualTime + delay,
      label ?? `setTimeout(${delay}ms)`
    );
    this.macrotaskQueue.push(task);
    return task.id;
  }

  clearTimeout(id: number): void {
    const task = this.macrotaskQueue.find((t) => t.id === id);
    if (task) task.cancelled = true;
  }

  /**
   * Schedule a repeating callback every `interval` ms.
   * Returns a handle that can be passed to clearInterval.
   */
  setInterval(callback: Callback, interval: number, label?: string): number {
    // The "handle" is what we return to the caller and use for clearInterval.
    // It stays constant across repeated firings.
    const handle = ++this.taskIdCounter;
    const task = this.createTask(
      "setInterval",
      callback,
      this.virtualTime + interval,
      label ?? `setInterval(${interval}ms)`,
      interval,
      handle
    );
    this.macrotaskQueue.push(task);
    return handle;
  }

  clearInterval(handle: number): void {
    // Mark all pending interval tasks with this handle as cancelled
    for (const t of this.macrotaskQueue) {
      if (t.intervalHandle === handle) t.cancelled = true;
    }
  }

  /**
   * Schedule a callback to run in the next iteration of the event loop,
   * before any setTimeout/setInterval callbacks (dueAt = current time).
   */
  setImmediate(callback: Callback, label?: string): number {
    const task = this.createTask(
      "setImmediate",
      callback,
      this.virtualTime, // eligible immediately
      label ?? "setImmediate"
    );
    this.macrotaskQueue.push(task);
    return task.id;
  }

  /**
   * Enqueue a microtask (analogous to Promise.resolve().then(fn)).
   * Microtasks always run before the next macrotask.
   */
  queueMicrotask(callback: Callback, label?: string): void {
    const task = this.createTask(
      "microtask",
      callback,
      this.virtualTime,
      label ?? "microtask"
    );
    this.microtaskQueue.push(task);
  }

  /**
   * Convenience: returns a thenable that resolves after `delay` ms.
   * The resolved .then() callback is queued as a microtask.
   */
  resolvedPromise(delay = 0, label?: string): { then(cb: Callback): void } {
    const loop = this;
    return {
      then(cb: Callback) {
        loop.setTimeout(
          () => loop.queueMicrotask(cb, label ?? "Promise.then"),
          delay
        );
      },
    };
  }

  // ─── Engine ──────────────────────────────────────────────────────────────

  /**
   * Run the event loop until no more tasks remain (or maxSteps is reached).
   */
  run(maxSteps = 10_000): void {
    this.printHeader();

    let steps = 0;
    while (steps++ < maxSteps) {
      // 1. Drain all microtasks first
      this.drainMicrotasks();

      // 2. Pick the next eligible macrotask
      const next = this.pickNextMacrotask();
      if (!next) break; // nothing left — loop is done

      // 3. Advance virtual clock to when the task is due
      if (next.dueAt > this.virtualTime) {
        this.virtualTime = next.dueAt;
      }

      // 4. Execute it
      this.executeTask(next);

      // 5. Re-schedule if it's a repeating interval (and still active)
      if (next.type === "setInterval" && !next.cancelled) {
        const repeated = this.createTask(
          "setInterval",
          next.callback,
          this.virtualTime + next.interval!,
          next.label,
          next.interval,
          next.intervalHandle // keep the same stable handle
        );
        this.macrotaskQueue.push(repeated);
      }
    }

    // Drain any final microtasks
    this.drainMicrotasks();

    this.printSummary();
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private createTask(
    type: Task["type"],
    callback: Callback,
    dueAt: number,
    label: string,
    interval?: number,
    intervalHandle?: number
  ): Task {
    return {
      id: ++this.taskIdCounter,
      type,
      label,
      callback,
      dueAt,
      interval,
      intervalHandle,
      cancelled: false,
    };
  }

  private drainMicrotasks(): void {
    // Keep looping: a microtask can enqueue more microtasks
    while (this.microtaskQueue.length > 0) {
      const task = this.microtaskQueue.shift()!;
      this.executeTask(task);
    }
  }

  private pickNextMacrotask(): Task | null {
    // Remove cancelled tasks
    this.macrotaskQueue = this.macrotaskQueue.filter((t) => !t.cancelled);
    if (this.macrotaskQueue.length === 0) return null;

    // Sort by dueAt ascending; setImmediate (dueAt === virtualTime) comes first
    // among same-time tasks, setImmediate beats setTimeout/setInterval
    this.macrotaskQueue.sort((a, b) => {
      if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
      // same dueAt: setImmediate wins
      const priority = (t: Task) => (t.type === "setImmediate" ? 0 : 1);
      return priority(a) - priority(b);
    });

    return this.macrotaskQueue.shift()!;
  }

  private executeTask(task: Task): void {
    const record: ExecutionRecord = {
      step: ++this.stepCounter,
      taskId: task.id,
      type: task.type,
      label: task.label,
      virtualTime: this.virtualTime,
    };
    this.log.push(record);

    if (this.verbose) {
      this.printTask(record);
    }

    task.callback();
  }

  // ─── Visualisation ───────────────────────────────────────────────────────

  private printHeader(): void {
    if (!this.verbose) return;
    console.log("\n╔══════════════════════════════════════════════════════╗");
    console.log("║           Mini Event Loop — Execution Trace           ║");
    console.log("╚══════════════════════════════════════════════════════╝");
    console.log(
      `${"Step".padEnd(6)} ${"T(ms)".padEnd(8)} ${"Type".padEnd(14)} Label`
    );
    console.log("─".repeat(60));
  }

  private printTask(r: ExecutionRecord): void {
    const typeColor: Record<Task["type"], string> = {
      microtask: "\x1b[36m", // cyan
      setTimeout: "\x1b[33m", // yellow
      setInterval: "\x1b[35m", // magenta
      setImmediate: "\x1b[32m", // green
    };
    const reset = "\x1b[0m";
    const color = typeColor[r.type];
    const stepStr = `[${r.step}]`.padEnd(6);
    const timeStr = `+${r.virtualTime}ms`.padEnd(8);
    const typeStr = (color + r.type + reset).padEnd(
      14 + color.length + reset.length
    );
    console.log(`${stepStr} ${timeStr} ${typeStr} ${r.label}`);
  }

  private printSummary(): void {
    if (!this.verbose) return;
    console.log("─".repeat(60));
    console.log(
      `✓ Done — ${this.stepCounter} tasks executed, virtual time: +${this.virtualTime}ms\n`
    );
  }

  /** Reset state (useful between test scenarios) */
  reset(): void {
    this.macrotaskQueue = [];
    this.microtaskQueue = [];
    this.virtualTime = 0;
    this.taskIdCounter = 0;
    this.stepCounter = 0;
    this.log.length = 0;
  }
}

// ─── Demo ─────────────────────────────────────────────────────────────────────
// Only runs when executed directly (not when imported by tests)

if (require.main === module) {
  const loop = new EventLoop({ verbose: true });

  console.log("=== Demo: Classic Event Loop Priority Test ===");
  console.log("Registered order: setTimeout(0), microtask, setImmediate\n");

  loop.setTimeout(
    () => {
      console.log("  → setTimeout callback running");
      // Scheduling a microtask *inside* a macrotask
      loop.queueMicrotask(
        () => console.log("  → microtask from inside setTimeout"),
        "inner microtask"
      );
    },
    0,
    "setTimeout(0ms)"
  );

  loop.queueMicrotask(
    () => console.log("  → early microtask running"),
    "early microtask"
  );

  loop.setImmediate(
    () => console.log("  → setImmediate callback running"),
    "setImmediate"
  );

  loop.setTimeout(
    () => console.log("  → setTimeout(100ms) callback running"),
    100,
    "setTimeout(100ms)"
  );

  const intervalId = loop.setInterval(
    () => console.log("  → setInterval(50ms) tick"),
    50,
    "setInterval(50ms)"
  );

  // Cancel interval after 3 ticks
  loop.setTimeout(
    () => {
      loop.clearInterval(intervalId);
      console.log("  → clearInterval called");
    },
    175,
    "clearInterval at 175ms"
  );

  loop.run();
}
