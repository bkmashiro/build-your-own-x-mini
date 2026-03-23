# 24-mini-scheduler

A minimal priority-based task scheduler in ~150 lines.

## Concepts

- **Priority Queue**: Tasks sorted by ready time, then priority
- **Delayed Execution**: Schedule tasks to run after a delay
- **Cancellation**: Cancel pending tasks by ID
- **Cooperative Scheduling**: Async tasks yield between executions

## Usage

```typescript
import { Scheduler } from './src/index';

const scheduler = new Scheduler();

// Basic task
scheduler.schedule(() => console.log('Hello'));

// With priority (lower = higher priority)
scheduler.schedule(() => console.log('First'), { priority: 1 });
scheduler.schedule(() => console.log('Second'), { priority: 2 });

// Delayed task
scheduler.setTimeout(() => console.log('Later'), 1000);

// Immediate (highest priority)
scheduler.immediate(() => console.log('Now!'));

// Cancel a task
const id = scheduler.schedule(() => console.log('Maybe'));
scheduler.cancel(id);

// Run all ready tasks
await scheduler.tick();

// Run until all tasks complete
await scheduler.run();
```

## API

### `Scheduler`

| Method | Description |
|--------|-------------|
| `schedule(fn, options?)` | Schedule task with optional delay/priority |
| `immediate(fn)` | Schedule with highest priority |
| `setTimeout(fn, delay)` | Schedule after delay |
| `cancel(id)` | Cancel a pending task |
| `tick()` | Execute all ready tasks |
| `run()` | Run until all tasks complete |
| `stop()` | Stop the scheduler |
| `pending` | Number of pending tasks |
| `clear()` | Remove all pending tasks |

### `IntervalScheduler`

| Method | Description |
|--------|-------------|
| `setInterval(fn, ms)` | Run task repeatedly |
| `clearInterval(id)` | Stop interval |

## Test

```bash
bun test
```
