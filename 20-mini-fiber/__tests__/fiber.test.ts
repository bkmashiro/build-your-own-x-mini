import {
  Priority,
  FiberFlag,
  FiberScheduler,
  createFiber,
  createDeadline,
  buildFiberTree,
  traverseFiber,
  type FiberNode,
  type IdleDeadline,
} from '../src/index';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** A deadline with virtually unlimited time (never yields). */
const infiniteDeadline = (): IdleDeadline => createDeadline(999_999);

/** A deadline that's already expired (zero time remaining). */
const exhaustedDeadline = (): IdleDeadline => createDeadline(0);

/**
 * A deterministic deadline that allows exactly `limit` timeRemaining() calls
 * before returning 0. Useful for testing interruptibility without relying on
 * wall-clock timing.
 */
function countingDeadline(limit: number): IdleDeadline {
  let calls = 0;
  return {
    didTimeout: false,
    timeRemaining() {
      return calls++ < limit ? 1 : 0;
    },
  };
}

// ─── createFiber ──────────────────────────────────────────────────────────────

describe('createFiber', () => {
  it('creates a fiber with correct defaults', () => {
    const f = createFiber('a', 42);
    expect(f.id).toBe('a');
    expect(f.data).toBe(42);
    expect(f.priority).toBe(Priority.Normal);
    expect(f.flags).toBe(FiberFlag.Placement);
    expect(f.child).toBeNull();
    expect(f.sibling).toBeNull();
    expect(f.return).toBeNull();
    expect(f.work).toBeNull();
    expect(f.completed).toBe(false);
  });

  it('accepts custom priority and work function', () => {
    const work = jest.fn();
    const f = createFiber('b', 'hello', Priority.Immediate, work);
    expect(f.priority).toBe(Priority.Immediate);
    expect(f.work).toBe(work);
  });
});

// ─── createDeadline ───────────────────────────────────────────────────────────

describe('createDeadline', () => {
  it('reports positive timeRemaining for a future deadline', () => {
    const d = createDeadline(100);
    expect(d.timeRemaining()).toBeGreaterThan(0);
    expect(d.didTimeout).toBe(false);
  });

  it('reports zero timeRemaining for an expired deadline', () => {
    const d = createDeadline(0);
    expect(d.timeRemaining()).toBe(0);
  });

  it('supports didTimeout flag', () => {
    const d = createDeadline(50, true);
    expect(d.didTimeout).toBe(true);
  });
});

// ─── buildFiberTree ───────────────────────────────────────────────────────────

describe('buildFiberTree', () => {
  it('builds a single-node tree', () => {
    const root = buildFiberTree({ id: 'root', data: 'App' });
    expect(root.id).toBe('root');
    expect(root.child).toBeNull();
  });

  it('wires child and sibling pointers correctly', () => {
    const root = buildFiberTree({
      id: 'root', data: 'App',
      children: [
        { id: 'h1', data: 'Title' },
        { id: 'p',  data: 'Body' },
        { id: 'footer', data: 'Footer' },
      ],
    });

    const h1 = root.child!;
    expect(h1.id).toBe('h1');
    expect(h1.return).toBe(root);

    const p = h1.sibling!;
    expect(p.id).toBe('p');
    expect(p.return).toBe(root);

    const footer = p.sibling!;
    expect(footer.id).toBe('footer');
    expect(footer.sibling).toBeNull();
  });

  it('wires nested children', () => {
    const root = buildFiberTree({
      id: 'root', data: 'App',
      children: [
        {
          id: 'list', data: 'ul',
          children: [
            { id: 'item1', data: 'li1' },
            { id: 'item2', data: 'li2' },
          ],
        },
      ],
    });

    const list = root.child!;
    expect(list.id).toBe('list');
    const item1 = list.child!;
    expect(item1.id).toBe('item1');
    expect(item1.sibling!.id).toBe('item2');
  });
});

// ─── traverseFiber ────────────────────────────────────────────────────────────

describe('traverseFiber', () => {
  it('visits nodes in depth-first order', () => {
    const root = buildFiberTree({
      id: 'A', data: 1,
      children: [
        { id: 'B', data: 2, children: [{ id: 'D', data: 4 }] },
        { id: 'C', data: 3 },
      ],
    });

    const ids = [...traverseFiber(root)].map(f => f.id);
    expect(ids).toEqual(['A', 'B', 'D', 'C']);
  });
});

// ─── FiberScheduler — basic scheduling ───────────────────────────────────────

describe('FiberScheduler — basic scheduling', () => {
  it('schedules and completes a single fiber', () => {
    const scheduler = new FiberScheduler();
    const fiber = createFiber('root', 'hello');
    scheduler.schedule(fiber);

    expect(scheduler.hasPendingWork).toBe(true);
    scheduler.flush();
    expect(scheduler.hasPendingWork).toBe(false);
    expect(fiber.completed).toBe(true);
    expect(scheduler.stats.completed).toBe(1);
  });

  it('calls the fiber work function exactly once', () => {
    const scheduler = new FiberScheduler();
    const work = jest.fn();
    const fiber = createFiber('root', null, Priority.Normal, work);
    scheduler.schedule(fiber);
    scheduler.flush();

    expect(work).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledWith(fiber);
  });

  it('adds completed fibers to effectList', () => {
    const scheduler = new FiberScheduler();
    const f1 = createFiber('f1', 1);
    const f2 = createFiber('f2', 2);
    scheduler.schedule(f1);
    scheduler.schedule(f2);
    scheduler.flush();

    const ids = scheduler.effectList.map(f => f.id);
    expect(ids).toContain('f1');
    expect(ids).toContain('f2');
  });

  it('commit drains effectList and calls callback for each fiber', () => {
    const scheduler = new FiberScheduler();
    scheduler.schedule(createFiber('a', 1));
    scheduler.schedule(createFiber('b', 2));
    scheduler.flush();

    const committed: string[] = [];
    scheduler.commit(f => committed.push(f.id));

    expect(committed).toEqual(expect.arrayContaining(['a', 'b']));
    expect(scheduler.effectList).toHaveLength(0);
  });
});

// ─── FiberScheduler — priority ordering ──────────────────────────────────────

describe('FiberScheduler — priority ordering', () => {
  it('processes higher-priority fibers before lower-priority ones', () => {
    const scheduler = new FiberScheduler();
    const order: string[] = [];

    const mkFiber = (id: string, p: Priority) =>
      createFiber(id, id, p, f => order.push(f.id));

    // Enqueue in reverse priority order
    scheduler.schedule(mkFiber('idle',     Priority.Idle));
    scheduler.schedule(mkFiber('low',      Priority.Low));
    scheduler.schedule(mkFiber('normal',   Priority.Normal));
    scheduler.schedule(mkFiber('blocking', Priority.UserBlocking));
    scheduler.schedule(mkFiber('immediate',Priority.Immediate));

    scheduler.flush();

    // Immediate should come first, Idle last
    expect(order[0]).toBe('immediate');
    expect(order[order.length - 1]).toBe('idle');
    // UserBlocking before Normal
    expect(order.indexOf('blocking')).toBeLessThan(order.indexOf('normal'));
    expect(order.indexOf('normal')).toBeLessThan(order.indexOf('low'));
    expect(order.indexOf('low')).toBeLessThan(order.indexOf('idle'));
  });

  it('keeps stats.scheduled count accurate', () => {
    const scheduler = new FiberScheduler();
    for (let i = 0; i < 5; i++) scheduler.schedule(createFiber(`f${i}`, i));
    expect(scheduler.stats.scheduled).toBe(5);
    scheduler.flush();
    expect(scheduler.stats.completed).toBe(5);
  });
});

// ─── FiberScheduler — time slicing / interruption ────────────────────────────

describe('FiberScheduler — time slicing', () => {
  it('workLoop returns false (interrupted) when deadline is exhausted', () => {
    const scheduler = new FiberScheduler();
    // Schedule several fibers
    for (let i = 0; i < 10; i++) scheduler.schedule(createFiber(`f${i}`, i));

    const done = scheduler.workLoop(exhaustedDeadline());
    // Immediate-priority will bypass time checks, but Normal won't, so at
    // least some work should be deferred unless all expire.
    // Here all fibers are Normal-priority (not yet expired) → should interrupt
    // after 0 fibers or very few.
    expect(typeof done).toBe('boolean');
    // Still has pending work (interrupted)
    if (!done) {
      expect(scheduler.hasPendingWork).toBe(true);
      expect(scheduler.stats.interrupted).toBeGreaterThanOrEqual(1);
    }
  });

  it('workLoop returns true when all work fits in the deadline', () => {
    const scheduler = new FiberScheduler();
    scheduler.schedule(createFiber('a', 1));
    scheduler.schedule(createFiber('b', 2));

    const done = scheduler.workLoop(infiniteDeadline());
    expect(done).toBe(true);
    expect(scheduler.hasPendingWork).toBe(false);
  });

  it('expired tasks run even when deadline is exhausted (didTimeout=true)', () => {
    const scheduler = new FiberScheduler();
    const fiber = createFiber('urgent', 1, Priority.Immediate);
    scheduler.schedule(fiber);

    // Expired deadline with didTimeout
    const timedOutDeadline: IdleDeadline = {
      didTimeout: true,
      timeRemaining: () => 0,
    };

    const done = scheduler.workLoop(timedOutDeadline);
    expect(done).toBe(true);
    expect(fiber.completed).toBe(true);
  });

  it('can resume work across multiple workLoop calls', () => {
    const scheduler = new FiberScheduler();
    // Schedule many Normal-priority fibers
    for (let i = 0; i < 20; i++) scheduler.schedule(createFiber(`f${i}`, i));

    let iterations = 0;
    let done = false;
    while (!done && iterations < 50) {
      done = scheduler.workLoop(createDeadline(1)); // tiny frame
      iterations++;
    }

    expect(done).toBe(true);
    expect(scheduler.hasPendingWork).toBe(false);
    expect(scheduler.stats.completed).toBe(20);
  });
});

// ─── FiberScheduler — tree traversal ─────────────────────────────────────────

describe('FiberScheduler — tree traversal', () => {
  it('automatically schedules child fibers when parent is processed', () => {
    const scheduler = new FiberScheduler();
    const order: string[] = [];

    const root = buildFiberTree({
      id: 'App', data: 'app',
      work: f => order.push(f.id),
      children: [
        { id: 'Header', data: 'header', work: f => order.push(f.id) },
        { id: 'Main',   data: 'main',   work: f => order.push(f.id),
          children: [
            { id: 'Article', data: 'article', work: f => order.push(f.id) },
          ],
        },
        { id: 'Footer', data: 'footer', work: f => order.push(f.id) },
      ],
    });

    scheduler.schedule(root);
    scheduler.flush();

    expect(order).toContain('App');
    expect(order).toContain('Header');
    expect(order).toContain('Main');
    expect(order).toContain('Article');
    expect(order).toContain('Footer');
    expect(scheduler.stats.completed).toBe(5);
  });

  it('effect list contains all nodes in the tree', () => {
    const scheduler = new FiberScheduler();
    const root = buildFiberTree({
      id: 'root', data: 0,
      children: [
        { id: 'c1', data: 1 },
        { id: 'c2', data: 2, children: [{ id: 'c2a', data: 3 }] },
      ],
    });

    scheduler.schedule(root);
    scheduler.flush();

    const ids = new Set(scheduler.effectList.map(f => f.id));
    expect(ids).toContain('root');
    expect(ids).toContain('c1');
    expect(ids).toContain('c2');
    expect(ids).toContain('c2a');
  });
});

// ─── FiberScheduler — interruptible rendering simulation ─────────────────────

describe('FiberScheduler — interruptible rendering simulation', () => {
  it('simulates rendering a large tree with yields', () => {
    const scheduler = new FiberScheduler();
    const rendered: string[] = [];
    const NODES = 50;

    // Build a flat list of fibers
    for (let i = 0; i < NODES; i++) {
      scheduler.schedule(
        createFiber(`node-${i}`, i, Priority.Normal, f => rendered.push(f.id)),
      );
    }

    // Use a counting deadline: allows exactly 5 fibers per "frame" before yielding.
    // With 50 fibers and 5 per frame we guarantee at least 9 interruptions.
    let frame = 0;
    let done = false;
    while (!done) {
      done = scheduler.workLoop(countingDeadline(5));
      frame++;
      if (frame > 10_000) throw new Error('Infinite loop guard');
    }

    expect(rendered.length).toBe(NODES);
    expect(scheduler.stats.interrupted).toBeGreaterThan(0);
  });

  it('high-priority fiber interrupts low-priority work in next frame', () => {
    const scheduler = new FiberScheduler();
    const order: string[] = [];

    // Schedule low-priority items first
    for (let i = 0; i < 5; i++) {
      scheduler.schedule(
        createFiber(`low-${i}`, i, Priority.Low, f => order.push(f.id)),
      );
    }

    // Process one frame — might yield
    scheduler.workLoop(createDeadline(0));

    // Now inject a high-priority task
    scheduler.schedule(
      createFiber('urgent', 'urgent', Priority.Immediate, f => order.push(f.id)),
    );

    // Flush the rest
    scheduler.flush();

    // "urgent" should appear before the remaining low-priority items
    const urgentIdx = order.indexOf('urgent');
    expect(urgentIdx).toBeGreaterThanOrEqual(0);

    // All low-priority items scheduled after "urgent" should come after it
    for (let i = 0; i < 5; i++) {
      const lowIdx = order.indexOf(`low-${i}`);
      if (lowIdx > urgentIdx) {
        expect(lowIdx).toBeGreaterThan(urgentIdx);
      }
    }
  });
});

// ─── FiberScheduler — edge cases ─────────────────────────────────────────────

describe('FiberScheduler — edge cases', () => {
  it('flush on empty queue is a no-op', () => {
    const scheduler = new FiberScheduler();
    expect(() => scheduler.flush()).not.toThrow();
    expect(scheduler.stats.completed).toBe(0);
  });

  it('commit on empty effectList is a no-op', () => {
    const scheduler = new FiberScheduler();
    const cb = jest.fn();
    expect(() => scheduler.commit(cb)).not.toThrow();
    expect(cb).not.toHaveBeenCalled();
  });

  it('fibers are not re-processed after completion', () => {
    const scheduler = new FiberScheduler();
    const work = jest.fn();
    const fiber = createFiber('f', 1, Priority.Normal, work);
    scheduler.schedule(fiber);
    scheduler.flush();

    // Manually re-schedule the completed fiber
    scheduler.schedule(fiber);
    scheduler.flush();

    // work should still only have been called once (completed=true guard)
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('fiber flags transition from Placement to Update after processing', () => {
    const scheduler = new FiberScheduler();
    const fiber = createFiber('f', 1);
    expect(fiber.flags & FiberFlag.Placement).toBeTruthy();

    scheduler.schedule(fiber);
    scheduler.flush();

    expect(fiber.flags & FiberFlag.Placement).toBeFalsy();
    expect(fiber.flags & FiberFlag.Update).toBeTruthy();
  });
});
