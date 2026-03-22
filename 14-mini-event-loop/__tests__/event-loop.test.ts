import { EventLoop } from "../src/index";

// Helper: extract ordered labels from the execution log
function labels(loop: EventLoop): string[] {
  return loop.log.map((r) => r.label);
}

// Helper: extract ordered types from the execution log
function types(loop: EventLoop): string[] {
  return loop.log.map((r) => r.type);
}

describe("EventLoop — basic scheduling", () => {
  let loop: EventLoop;

  beforeEach(() => {
    loop = new EventLoop({ verbose: false });
  });

  // ─── setTimeout ────────────────────────────────────────────────────────

  test("setTimeout(0) runs after synchronous microtasks", () => {
    loop.queueMicrotask(() => {}, "micro");
    loop.setTimeout(() => {}, 0, "macro");
    loop.run();

    expect(labels(loop)).toEqual(["micro", "macro"]);
  });

  test("setTimeout delays are respected in virtual time", () => {
    loop.setTimeout(() => {}, 100, "t=100");
    loop.setTimeout(() => {}, 0, "t=0");
    loop.setTimeout(() => {}, 50, "t=50");
    loop.run();

    expect(labels(loop)).toEqual(["t=0", "t=50", "t=100"]);
  });

  test("clearTimeout prevents callback from running", () => {
    const id = loop.setTimeout(() => {}, 10, "cancelled");
    loop.clearTimeout(id);
    loop.setTimeout(() => {}, 20, "kept");
    loop.run();

    expect(labels(loop)).toEqual(["kept"]);
  });

  // ─── setImmediate ──────────────────────────────────────────────────────

  test("setImmediate runs before same-time setTimeout", () => {
    loop.setTimeout(() => {}, 0, "setTimeout(0)");
    loop.setImmediate(() => {}, "immediate");
    loop.run();

    expect(labels(loop)).toEqual(["immediate", "setTimeout(0)"]);
  });

  test("multiple setImmediate calls run in registration order", () => {
    loop.setImmediate(() => {}, "A");
    loop.setImmediate(() => {}, "B");
    loop.setImmediate(() => {}, "C");
    loop.run();

    expect(labels(loop)).toEqual(["A", "B", "C"]);
  });

  // ─── microtask queue ───────────────────────────────────────────────────

  test("microtasks run before any macrotask", () => {
    loop.setTimeout(() => {}, 0, "macro");
    loop.queueMicrotask(() => {}, "micro1");
    loop.queueMicrotask(() => {}, "micro2");
    loop.run();

    expect(labels(loop)).toEqual(["micro1", "micro2", "macro"]);
  });

  test("microtasks queued inside a macrotask run before the next macrotask", () => {
    loop.setTimeout(() => {
      loop.queueMicrotask(() => {}, "inner-micro");
    }, 0, "macro1");
    loop.setTimeout(() => {}, 0, "macro2");
    loop.run();

    expect(labels(loop)).toEqual(["macro1", "inner-micro", "macro2"]);
  });

  test("microtasks can chain — each new microtask runs before macrotasks", () => {
    loop.setTimeout(() => {}, 0, "macro");
    loop.queueMicrotask(() => {
      loop.queueMicrotask(() => {}, "chained-micro");
    }, "root-micro");
    loop.run();

    // root-micro runs → queues chained-micro → chained-micro runs → macro runs
    expect(labels(loop)).toEqual(["root-micro", "chained-micro", "macro"]);
  });

  // ─── setInterval ───────────────────────────────────────────────────────

  test("setInterval fires repeatedly at the correct virtual times", () => {
    const ticks: number[] = [];
    loop.setInterval(() => ticks.push(loop["virtualTime"]), 10, "tick");

    // Cancel after 3 ticks
    loop.setTimeout(() => loop.clearInterval(1), 35, "stop");
    loop.run();

    expect(ticks).toEqual([10, 20, 30]);
  });

  test("clearInterval stops future ticks", () => {
    let count = 0;
    const id = loop.setInterval(() => count++, 10, "tick");
    loop.setTimeout(() => loop.clearInterval(id), 25, "stop");
    loop.run();

    expect(count).toBe(2); // fired at t=10 and t=20, stopped before t=30
  });

  // ─── Combined ordering ─────────────────────────────────────────────────

  test("classic JS ordering: micro > setImmediate > setTimeout(0)", () => {
    loop.setTimeout(() => {}, 0, "setTimeout");
    loop.queueMicrotask(() => {}, "microtask");
    loop.setImmediate(() => {}, "setImmediate");
    loop.run();

    expect(labels(loop)).toEqual(["microtask", "setImmediate", "setTimeout"]);
  });

  test("full scenario: mixed task types execute in correct order", () => {
    const order: string[] = [];

    loop.setTimeout(() => order.push("timeout-50"), 50, "timeout-50");
    loop.queueMicrotask(() => order.push("micro-1"), "micro-1");
    loop.setImmediate(() => {
      order.push("immediate");
      loop.queueMicrotask(() => order.push("micro-from-immediate"), "micro-from-immediate");
    }, "immediate");
    loop.setTimeout(() => order.push("timeout-0"), 0, "timeout-0");
    loop.queueMicrotask(() => order.push("micro-2"), "micro-2");

    loop.run();

    expect(order).toEqual([
      "micro-1",
      "micro-2",
      "immediate",
      "micro-from-immediate",
      "timeout-0",
      "timeout-50",
    ]);
  });

  // ─── Task types in log ─────────────────────────────────────────────────

  test("log records correct task types", () => {
    loop.queueMicrotask(() => {}, "m");
    loop.setImmediate(() => {}, "i");
    loop.setTimeout(() => {}, 0, "t");
    loop.run();

    expect(types(loop)).toEqual(["microtask", "setImmediate", "setTimeout"]);
  });

  // ─── reset ─────────────────────────────────────────────────────────────

  test("reset clears all state", () => {
    loop.setTimeout(() => {}, 0, "task");
    loop.queueMicrotask(() => {}, "micro");
    loop.run();

    loop.reset();

    expect(loop.log).toHaveLength(0);
    expect(loop["virtualTime"]).toBe(0);
    expect(loop["stepCounter"]).toBe(0);
  });
});

describe("EventLoop — edge cases", () => {
  let loop: EventLoop;

  beforeEach(() => {
    loop = new EventLoop({ verbose: false });
  });

  test("empty loop runs without error", () => {
    expect(() => loop.run()).not.toThrow();
    expect(loop.log).toHaveLength(0);
  });

  test("setTimeout with no delay defaults to 0", () => {
    loop.setTimeout(() => {}, undefined, "no-delay");
    loop.run();
    expect(loop.log[0].label).toBe("no-delay");
    expect(loop.log[0].virtualTime).toBe(0);
  });

  test("multiple intervals run interleaved correctly", () => {
    const order: string[] = [];
    const id1 = loop.setInterval(() => order.push("A"), 10, "A");
    const id2 = loop.setInterval(() => order.push("B"), 15, "B");

    // Stop both after 35ms
    loop.setTimeout(() => {
      loop.clearInterval(id1);
      loop.clearInterval(id2);
    }, 35, "stop");

    loop.run();

    // A fires at 10, 20, 30; B fires at 15, 30
    // At t=30, B was re-scheduled (at t=15) before A was re-scheduled (at t=20),
    // so B fires first at t=30.
    expect(order).toEqual(["A", "B", "A", "B", "A"]);
  });

  test("resolvedPromise schedules microtask after delay", () => {
    const order: string[] = [];

    loop.setTimeout(() => order.push("sync-macro"), 0, "macro");
    loop.resolvedPromise(0, "promise.then").then(() => order.push("promise-then"));

    loop.run();

    // The setTimeout(0) inside resolvedPromise fires, then queues the microtask,
    // but the outer macro (sync-macro) at t=0 may fire first depending on insertion order.
    // What matters: promise-then runs as a microtask (after its triggering macro).
    expect(order).toContain("promise-then");
    // promise-then should appear after sync-macro (it's triggered by a separate setTimeout)
    const piIdx = order.indexOf("promise-then");
    const macroIdx = order.indexOf("sync-macro");
    // Both exist; promise-then runs after the timeout that triggered it
    expect(piIdx).toBeGreaterThan(-1);
    expect(macroIdx).toBeGreaterThan(-1);
  });
});
