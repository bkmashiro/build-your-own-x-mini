# 27-mini-pubsub

A minimal publish-subscribe messaging system in ~180 lines.

## Concepts

- **Topic-based messaging**: Subscribe to specific topics
- **Wildcard subscriptions**: `user.*` matches `user.login`, `user.logout`
- **Message history**: Store and replay past messages
- **Once listeners**: Auto-unsubscribe after first message

## Usage

```typescript
import { PubSub, EventEmitter } from './src/index';

// Basic pub/sub
const pubsub = new PubSub<string>();

const unsub = pubsub.subscribe('news', (msg) => {
  console.log('Received:', msg);
});

pubsub.publish('news', 'Breaking: TypeScript is awesome');

unsub(); // Unsubscribe

// Wildcard subscriptions
pubsub.subscribe('user.*', (msg, topic) => {
  console.log(`${topic}: ${msg}`);
});

pubsub.publish('user.login', 'alice');   // Matches
pubsub.publish('user.logout', 'bob');    // Matches
pubsub.publish('system.start', 'ignored'); // No match

// Once listener
pubsub.once('alert', (msg) => {
  console.log('Alert (only once):', msg);
});

// Message history
const withHistory = new PubSub<number>({ maxHistory: 10 });
withHistory.publish('counter', 1);
withHistory.publish('counter', 2);
console.log(withHistory.getHistory('counter')); // [1, 2]

// Replay to new subscriber
withHistory.replay('counter', (n) => console.log('Replayed:', n));

// Typed EventEmitter
interface Events {
  login: { user: string };
  logout: { user: string };
}

const emitter = new EventEmitter<Events>();
emitter.on('login', (data) => console.log(`${data.user} logged in`));
emitter.emit('login', { user: 'alice' });
```

## API

### `PubSub<T>`

| Method | Description |
|--------|-------------|
| `subscribe(topic, listener)` | Subscribe to topic, returns unsubscribe function |
| `once(topic, listener)` | Subscribe once |
| `publish(topic, message)` | Publish message, returns delivery count |
| `getHistory(topic)` | Get message history |
| `replay(topic, listener)` | Replay history then subscribe |
| `subscriberCount(topic)` | Get number of subscribers |
| `hasSubscribers(topic)` | Check if topic has subscribers |
| `clear()` | Remove all subscriptions |
| `clearHistory()` | Clear message history |

### Wildcards

| Pattern | Matches |
|---------|---------|
| `user.*` | `user.login`, `user.logout` |
| `events.**` | `events.user.login`, `events.system.crash` |

## Test

```bash
bun test
```
