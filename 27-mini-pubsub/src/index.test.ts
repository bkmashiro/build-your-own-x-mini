import { describe, it, expect } from 'bun:test';
import { PubSub, EventEmitter } from './index';

describe('PubSub', () => {
  it('should deliver messages to subscribers', () => {
    const pubsub = new PubSub<string>();
    const received: string[] = [];

    pubsub.subscribe('test', (msg) => received.push(msg));
    pubsub.publish('test', 'hello');

    expect(received).toEqual(['hello']);
  });

  it('should support multiple subscribers', () => {
    const pubsub = new PubSub<number>();
    let sum = 0;

    pubsub.subscribe('add', (n) => sum += n);
    pubsub.subscribe('add', (n) => sum += n * 2);
    pubsub.publish('add', 5);

    expect(sum).toBe(15); // 5 + 10
  });

  it('should unsubscribe correctly', () => {
    const pubsub = new PubSub<string>();
    const received: string[] = [];

    const unsub = pubsub.subscribe('test', (msg) => received.push(msg));
    pubsub.publish('test', 'first');
    unsub();
    pubsub.publish('test', 'second');

    expect(received).toEqual(['first']);
  });

  it('should support once listeners', () => {
    const pubsub = new PubSub<string>();
    const received: string[] = [];

    pubsub.once('test', (msg) => received.push(msg));
    pubsub.publish('test', 'first');
    pubsub.publish('test', 'second');

    expect(received).toEqual(['first']);
  });

  it('should support wildcard subscriptions', () => {
    const pubsub = new PubSub<string>();
    const received: string[] = [];

    pubsub.subscribe('user.*', (msg, topic) => received.push(`${topic}:${msg}`));
    pubsub.publish('user.login', 'alice');
    pubsub.publish('user.logout', 'bob');
    pubsub.publish('system.start', 'ignored');

    expect(received).toEqual(['user.login:alice', 'user.logout:bob']);
  });

  it('should support ** wildcard', () => {
    const pubsub = new PubSub<string>();
    const received: string[] = [];

    pubsub.subscribe('events.**', (msg) => received.push(msg));
    pubsub.publish('events.user.login', 'a');
    pubsub.publish('events.system.start', 'b');

    expect(received).toEqual(['a', 'b']);
  });

  it('should store and retrieve history', () => {
    const pubsub = new PubSub<number>({ maxHistory: 3 });

    pubsub.publish('counter', 1);
    pubsub.publish('counter', 2);
    pubsub.publish('counter', 3);
    pubsub.publish('counter', 4);

    const history = pubsub.getHistory('counter');
    expect(history).toEqual([2, 3, 4]); // Only last 3
  });

  it('should replay history to new subscribers', () => {
    const pubsub = new PubSub<string>({ maxHistory: 10 });
    const received: string[] = [];

    pubsub.publish('log', 'old1');
    pubsub.publish('log', 'old2');

    pubsub.replay('log', (msg) => received.push(msg));
    pubsub.publish('log', 'new');

    expect(received).toEqual(['old1', 'old2', 'new']);
  });

  it('should report subscriber count', () => {
    const pubsub = new PubSub();

    expect(pubsub.subscriberCount('test')).toBe(0);

    const unsub1 = pubsub.subscribe('test', () => {});
    const unsub2 = pubsub.subscribe('test', () => {});

    expect(pubsub.subscriberCount('test')).toBe(2);

    unsub1();
    expect(pubsub.subscriberCount('test')).toBe(1);
  });

  it('should return delivery count', () => {
    const pubsub = new PubSub();

    pubsub.subscribe('test', () => {});
    pubsub.subscribe('test', () => {});

    const count = pubsub.publish('test', 'data');
    expect(count).toBe(2);
  });
});

describe('PubSub - history replay boundaries', () => {
  it('exact-topic replay delivers all history before subscribing', () => {
    const pubsub = new PubSub<string>({ maxHistory: 10 });
    const received: string[] = [];

    pubsub.publish('orders', 'a');
    pubsub.publish('orders', 'b');

    pubsub.replay('orders', (msg) => received.push(msg));
    pubsub.publish('orders', 'c');

    expect(received).toEqual(['a', 'b', 'c']);
  });

  it('exact-topic replay respects maxHistory cap', () => {
    const pubsub = new PubSub<number>({ maxHistory: 2 });
    const received: number[] = [];

    pubsub.publish('n', 1);
    pubsub.publish('n', 2);
    pubsub.publish('n', 3); // evicts 1

    pubsub.replay('n', (msg) => received.push(msg));

    expect(received).toEqual([2, 3]);
  });

  it('exact-topic replay returns nothing when maxHistory is 0 (default)', () => {
    const pubsub = new PubSub<string>(); // maxHistory defaults to 0
    const received: string[] = [];

    pubsub.publish('log', 'old');
    pubsub.replay('log', (msg) => received.push(msg));

    expect(received).toEqual([]);
  });

  // LIMITATION: wildcard patterns are stored in wildcardSubs but history is
  // keyed by exact topic. replay() calls getHistory(topic) with the literal
  // pattern string, which never matches any stored key, so no history is
  // replayed. Wildcards are future-only subscriptions after replay().
  it('wildcard single-segment (*) does NOT replay history — limitation', () => {
    const pubsub = new PubSub<string>({ maxHistory: 10 });
    const received: string[] = [];

    pubsub.publish('orders.created', 'order-1');
    pubsub.publish('orders.updated', 'order-2');

    pubsub.replay('orders.*', (msg) => received.push(msg));
    pubsub.publish('orders.created', 'order-3'); // received via wildcard sub

    // History for 'orders.created' and 'orders.updated' is NOT replayed
    // because replay() looks up history by the literal pattern 'orders.*'
    expect(received).toEqual(['order-3']);
  });

  it('wildcard double-segment (**) does NOT replay history — limitation', () => {
    const pubsub = new PubSub<string>({ maxHistory: 10 });
    const received: string[] = [];

    pubsub.publish('events.user.login', 'alice');
    pubsub.publish('events.system.boot', 'srv1');

    pubsub.replay('events.**', (msg) => received.push(msg));
    pubsub.publish('events.user.logout', 'alice'); // received via wildcard sub

    expect(received).toEqual(['alice']); // only the post-replay publish
  });
});

describe('PubSub - async listener behavior', () => {
  // LIMITATION: listeners are invoked synchronously and their return value is
  // discarded. Async listeners are not awaited, so side-effects that complete
  // after publish() returns are invisible to callers.
  it('async listener is not awaited — fire-and-forget', async () => {
    const pubsub = new PubSub<string>();
    const log: string[] = [];

    pubsub.subscribe('task', async (msg) => {
      await Promise.resolve(); // microtask boundary
      log.push(`done:${msg}`);
    });

    const count = pubsub.publish('task', 'work');

    // publish() returned, but the async listener has not finished yet
    expect(count).toBe(1);
    expect(log).toEqual([]); // nothing written yet

    await Promise.resolve(); // flush microtask queue
    expect(log).toEqual(['done:work']); // now it's done
  });

  it('multiple async listeners all fire but none are awaited', async () => {
    const pubsub = new PubSub<number>();
    const results: number[] = [];

    pubsub.subscribe('compute', async (n) => {
      await Promise.resolve();
      results.push(n * 2);
    });
    pubsub.subscribe('compute', async (n) => {
      await Promise.resolve();
      results.push(n * 3);
    });

    pubsub.publish('compute', 4);

    expect(results).toEqual([]); // not yet

    await Promise.resolve();
    expect(results).toEqual([8, 12]);
  });
});

describe('EventEmitter', () => {
  it('should emit typed events', () => {
    interface Events {
      login: { user: string };
      logout: { user: string };
    }

    const emitter = new EventEmitter<Events>();
    const received: string[] = [];

    emitter.on('login', (data) => received.push(data.user));
    emitter.emit('login', { user: 'alice' });

    expect(received).toEqual(['alice']);
  });

  it('should support once', () => {
    interface Events {
      ping: number;
    }

    const emitter = new EventEmitter<Events>();
    const received: number[] = [];

    emitter.once('ping', (n) => received.push(n));
    emitter.emit('ping', 1);
    emitter.emit('ping', 2);

    expect(received).toEqual([1]);
  });
});
