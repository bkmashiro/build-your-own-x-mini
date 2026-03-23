/**
 * Mini Scheduler - A simple priority-based task scheduler
 * 
 * Concepts:
 * - Priority queue for task ordering
 * - Delayed task execution
 * - Task cancellation
 * - Cooperative scheduling (yield points)
 */

export type TaskId = number;

export interface Task {
  id: TaskId;
  fn: () => void | Promise<void>;
  priority: number;  // Lower = higher priority
  scheduledAt: number;
  delay: number;
}

export class Scheduler {
  private tasks: Task[] = [];
  private nextId = 1;
  private running = false;
  private cancelled = new Set<TaskId>();

  /**
   * Schedule a task with optional delay and priority
   */
  schedule(fn: () => void | Promise<void>, options: { delay?: number; priority?: number } = {}): TaskId {
    const id = this.nextId++;
    const task: Task = {
      id,
      fn,
      priority: options.priority ?? 0,
      scheduledAt: Date.now(),
      delay: options.delay ?? 0,
    };
    
    this.tasks.push(task);
    this.tasks.sort((a, b) => {
      // First by ready time
      const aReady = a.scheduledAt + a.delay;
      const bReady = b.scheduledAt + b.delay;
      if (aReady !== bReady) return aReady - bReady;
      // Then by priority
      return a.priority - b.priority;
    });
    
    return id;
  }

  /**
   * Schedule a task to run immediately (highest priority)
   */
  immediate(fn: () => void | Promise<void>): TaskId {
    return this.schedule(fn, { priority: -Infinity });
  }

  /**
   * Schedule a task to run after delay
   */
  setTimeout(fn: () => void | Promise<void>, delay: number): TaskId {
    return this.schedule(fn, { delay });
  }

  /**
   * Cancel a scheduled task
   */
  cancel(id: TaskId): boolean {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      this.tasks.splice(index, 1);
      this.cancelled.add(id);
      return true;
    }
    return false;
  }

  /**
   * Check if a task was cancelled
   */
  wasCancelled(id: TaskId): boolean {
    return this.cancelled.has(id);
  }

  /**
   * Run all ready tasks
   */
  async tick(): Promise<number> {
    const now = Date.now();
    let executed = 0;

    while (this.tasks.length > 0) {
      const task = this.tasks[0];
      const readyAt = task.scheduledAt + task.delay;
      
      if (readyAt > now) break;
      
      this.tasks.shift();
      
      if (this.cancelled.has(task.id)) {
        this.cancelled.delete(task.id);
        continue;
      }
      
      try {
        await task.fn();
      } catch (e) {
        console.error(`Task ${task.id} failed:`, e);
      }
      
      executed++;
    }
    
    return executed;
  }

  /**
   * Run scheduler until all tasks complete
   */
  async run(): Promise<void> {
    this.running = true;
    
    while (this.running && this.tasks.length > 0) {
      const executed = await this.tick();
      
      if (executed === 0 && this.tasks.length > 0) {
        // Wait for next task
        const nextTask = this.tasks[0];
        const waitTime = (nextTask.scheduledAt + nextTask.delay) - Date.now();
        if (waitTime > 0) {
          await new Promise(r => setTimeout(r, waitTime));
        }
      }
    }
    
    this.running = false;
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.running = false;
  }

  /**
   * Get pending task count
   */
  get pending(): number {
    return this.tasks.length;
  }

  /**
   * Clear all pending tasks
   */
  clear(): void {
    this.tasks = [];
    this.cancelled.clear();
  }
}

/**
 * Interval scheduler - run a task repeatedly
 */
export class IntervalScheduler {
  private scheduler: Scheduler;
  private intervals = new Map<TaskId, { fn: () => void; interval: number; active: boolean }>();

  constructor(scheduler?: Scheduler) {
    this.scheduler = scheduler ?? new Scheduler();
  }

  setInterval(fn: () => void, interval: number): TaskId {
    const id = this.scheduler.schedule(() => {});  // Get an ID
    
    const wrapped = () => {
      if (!this.intervals.get(id)?.active) return;
      fn();
      this.scheduler.setTimeout(wrapped, interval);
    };
    
    this.intervals.set(id, { fn: wrapped, interval, active: true });
    this.scheduler.setTimeout(wrapped, interval);
    
    return id;
  }

  clearInterval(id: TaskId): void {
    const interval = this.intervals.get(id);
    if (interval) {
      interval.active = false;
      this.intervals.delete(id);
    }
  }

  get scheduler_(): Scheduler {
    return this.scheduler;
  }
}

export default Scheduler;
