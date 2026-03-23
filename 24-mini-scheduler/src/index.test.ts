import { describe, it, expect } from 'bun:test';
import { Scheduler, IntervalScheduler } from './index';

describe('Scheduler', () => {
  it('should execute tasks in order', async () => {
    const scheduler = new Scheduler();
    const results: number[] = [];

    scheduler.schedule(() => results.push(1));
    scheduler.schedule(() => results.push(2));
    scheduler.schedule(() => results.push(3));

    await scheduler.tick();

    expect(results).toEqual([1, 2, 3]);
  });

  it('should respect priority', async () => {
    const scheduler = new Scheduler();
    const results: number[] = [];

    scheduler.schedule(() => results.push(3), { priority: 3 });
    scheduler.schedule(() => results.push(1), { priority: 1 });
    scheduler.schedule(() => results.push(2), { priority: 2 });

    await scheduler.tick();

    expect(results).toEqual([1, 2, 3]);
  });

  it('should handle delayed tasks', async () => {
    const scheduler = new Scheduler();
    const results: number[] = [];

    scheduler.schedule(() => results.push(2), { delay: 50 });
    scheduler.schedule(() => results.push(1), { delay: 0 });

    await scheduler.tick();
    expect(results).toEqual([1]);

    // Wait for delayed task
    await new Promise(r => setTimeout(r, 60));
    await scheduler.tick();
    expect(results).toEqual([1, 2]);
  });

  it('should cancel tasks', async () => {
    const scheduler = new Scheduler();
    const results: number[] = [];

    scheduler.schedule(() => results.push(1));
    const id = scheduler.schedule(() => results.push(2));
    scheduler.schedule(() => results.push(3));

    scheduler.cancel(id);
    await scheduler.tick();

    expect(results).toEqual([1, 3]);
    expect(scheduler.wasCancelled(id)).toBe(true);
  });

  it('should execute immediate tasks first', async () => {
    const scheduler = new Scheduler();
    const results: number[] = [];

    scheduler.schedule(() => results.push(2));
    scheduler.immediate(() => results.push(1));
    scheduler.schedule(() => results.push(3));

    await scheduler.tick();

    expect(results).toEqual([1, 2, 3]);
  });

  it('should run until complete', async () => {
    const scheduler = new Scheduler();
    const results: number[] = [];

    scheduler.setTimeout(() => results.push(1), 10);
    scheduler.setTimeout(() => results.push(2), 20);

    await scheduler.run();

    expect(results).toEqual([1, 2]);
    expect(scheduler.pending).toBe(0);
  });

  it('should handle async tasks', async () => {
    const scheduler = new Scheduler();
    const results: number[] = [];

    scheduler.schedule(async () => {
      await new Promise(r => setTimeout(r, 10));
      results.push(1);
    });
    scheduler.schedule(() => results.push(2));

    await scheduler.tick();

    expect(results).toEqual([1, 2]);
  });

  it('should clear all tasks', () => {
    const scheduler = new Scheduler();

    scheduler.schedule(() => {});
    scheduler.schedule(() => {});
    expect(scheduler.pending).toBe(2);

    scheduler.clear();
    expect(scheduler.pending).toBe(0);
  });
});

describe('IntervalScheduler', () => {
  it('should run at intervals', async () => {
    const intervalScheduler = new IntervalScheduler();
    const results: number[] = [];
    let count = 0;

    intervalScheduler.setInterval(() => {
      count++;
      results.push(count);
    }, 20);

    // Run for ~50ms
    const start = Date.now();
    while (Date.now() - start < 55) {
      await intervalScheduler.scheduler_.tick();
      await new Promise(r => setTimeout(r, 5));
    }

    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});
