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

  it('should count wildcard subscribers in subscriberCount', () => {
    const pubsub = new PubSub<string>();

    pubsub.subscribe('user.*', () => {});

    expect(pubsub.subscriberCount('user.login')).toBe(1);
    expect(pubsub.subscriberCount('user.logout')).toBe(1);
    // Non-matching topic should not count the wildcard subscriber
    expect(pubsub.subscriberCount('system.start')).toBe(0);
  });

  it('should return delivery count', () => {
    const pubsub = new PubSub();

    pubsub.subscribe('test', () => {});
    pubsub.subscribe('test', () => {});

    const count = pubsub.publish('test', 'data');
    expect(count).toBe(2);
  });

  it('calling unsubscribe twice is a no-op and does not throw', () => {
    const pubsub = new PubSub<string>();
    const received: string[] = [];

    const unsub = pubsub.subscribe('test', (msg) => received.push(msg));
    pubsub.publish('test', 'first');
    unsub();
    expect(() => unsub()).not.toThrow();
    pubsub.publish('test', 'second');

    expect(received).toEqual(['first']);
  });

  it('off() via returned unsubscribe removes a once() listener before it fires', () => {
    const pubsub = new PubSub<string>();
    const received: string[] = [];

    const unsub = pubsub.once('test', (msg) => received.push(msg));
    unsub();
    pubsub.publish('test', 'should-not-arrive');

    expect(received).toEqual([]);
  });

  it('replay() on a topic with no history subscribes without calling the handler', () => {
    const pubsub = new PubSub<string>({ maxHistory: 10 });
    const received: string[] = [];

    pubsub.replay('empty-topic', (msg) => received.push(msg));

    expect(received).toEqual([]);
  });

  it('delivery count is not incremented for once() listeners on the second publish', () => {
    const pubsub = new PubSub<string>();

    pubsub.once('test', () => {});

    const firstCount = pubsub.publish('test', 'first');
    const secondCount = pubsub.publish('test', 'second');

    expect(firstCount).toBe(1);
    expect(secondCount).toBe(0);
  });
});

describe('matchWildcard edge cases', () => {
  it('* does not match multiple segments', () => {
    const pubsub = new PubSub<string>();
    const received: string[] = [];

    pubsub.subscribe('user.*', (msg) => received.push(msg));
    pubsub.publish('user.login.extra', 'deep');

    expect(received).toEqual([]);
  });

  it('** matches zero additional segments', () => {
    const pubsub = new PubSub<string>();
    const received: string[] = [];

    pubsub.subscribe('events.**', (msg) => received.push(msg));
    // "events" itself has no segment after the dot, but "events.**" split is
    // ['events', '**'] — publishing 'events' alone ('events' split is ['events'])
    // won't match because the pattern has 2 parts while the topic has 1.
    pubsub.publish('events', 'root');
    pubsub.publish('events.a', 'one');
    pubsub.publish('events.a.b.c', 'deep');

    expect(received).toEqual(['one', 'deep']);
  });

  it('** matches many nested segments', () => {
    const pubsub = new PubSub<string>();
    const received: string[] = [];

    pubsub.subscribe('a.**', (msg) => received.push(msg));
    pubsub.publish('a.b.c.d.e', 'deep');

    expect(received).toEqual(['deep']);
  });

  it('exact pattern does not match longer topic', () => {
    const pubsub = new PubSub<string>();
    const received: string[] = [];

    pubsub.subscribe('user.login', (msg) => received.push(msg));
    pubsub.publish('user.login.extra', 'nope');

    expect(received).toEqual([]);
  });

  it('* does not match zero segments (short topic)', () => {
    const pubsub = new PubSub<string>();
    const received: string[] = [];

    pubsub.subscribe('user.*', (msg) => received.push(msg));
    pubsub.publish('user', 'nope');

    expect(received).toEqual([]);
  });

  it('wildcard once fires only on first matching publish', () => {
    const pubsub = new PubSub<string>();
    const received: string[] = [];

    pubsub.once('user.*', (msg) => received.push(msg));
    pubsub.publish('user.login', 'first');
    pubsub.publish('user.logout', 'second');

    expect(received).toEqual(['first']);
  });

  it('unsubscribe stops wildcard delivery', () => {
    const pubsub = new PubSub<string>();
    const received: string[] = [];

    const unsub = pubsub.subscribe('user.*', (msg) => received.push(msg));
    pubsub.publish('user.login', 'before');
    unsub();
    pubsub.publish('user.logout', 'after');

    expect(received).toEqual(['before']);
  });

  it('subscriberCount includes matching wildcard subs', () => {
    const pubsub = new PubSub();

    pubsub.subscribe('user.*', () => {});
    pubsub.subscribe('user.*', () => {});

    expect(pubsub.subscriberCount('user.login')).toBe(2);
    expect(pubsub.subscriberCount('system.start')).toBe(0);
  });

  it('** pattern does not match sibling prefix', () => {
    const pubsub = new PubSub<string>();
    const received: string[] = [];

    pubsub.subscribe('events.**', (msg) => received.push(msg));
    pubsub.publish('other.events.login', 'nope');

    expect(received).toEqual([]);
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

describe('PubSub - additional methods', () => {
  describe('hasSubscribers', () => {
    it('should return false when no subscribers', () => {
      const pubsub = new PubSub();
      expect(pubsub.hasSubscribers('test')).toBe(false);
    });

    it('should return true after subscribing', () => {
      const pubsub = new PubSub();
      pubsub.subscribe('test', () => {});
      expect(pubsub.hasSubscribers('test')).toBe(true);
    });

    it('should return false after unsubscribing last listener', () => {
      const pubsub = new PubSub();
      const unsub = pubsub.subscribe('test', () => {});
      unsub();
      expect(pubsub.hasSubscribers('test')).toBe(false);
    });

    it('should return true when matched by wildcard subscriber', () => {
      const pubsub = new PubSub();
      pubsub.subscribe('user.*', () => {});
      expect(pubsub.hasSubscribers('user.login')).toBe(true);
      expect(pubsub.hasSubscribers('system.start')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all exact subscriptions', () => {
      const pubsub = new PubSub();
      pubsub.subscribe('a', () => {});
      pubsub.subscribe('b', () => {});
      pubsub.clear();
      expect(pubsub.subscriberCount('a')).toBe(0);
      expect(pubsub.subscriberCount('b')).toBe(0);
    });

    it('should remove all wildcard subscriptions', () => {
      const pubsub = new PubSub();
      pubsub.subscribe('user.*', () => {});
      pubsub.clear();
      expect(pubsub.hasSubscribers('user.login')).toBe(false);
    });

    it('should not clear history', () => {
      const pubsub = new PubSub<number>({ maxHistory: 5 });
      pubsub.publish('counter', 1);
      pubsub.clear();
      expect(pubsub.getHistory('counter')).toEqual([1]);
    });

    it('should allow new subscriptions after clear', () => {
      const pubsub = new PubSub<string>();
      const received: string[] = [];
      pubsub.subscribe('test', () => {});
      pubsub.clear();
      pubsub.subscribe('test', (msg) => received.push(msg));
      pubsub.publish('test', 'after-clear');
      expect(received).toEqual(['after-clear']);
    });
  });

  describe('clearHistory', () => {
    it('should remove stored history', () => {
      const pubsub = new PubSub<number>({ maxHistory: 5 });
      pubsub.publish('counter', 1);
      pubsub.publish('counter', 2);
      pubsub.clearHistory();
      expect(pubsub.getHistory('counter')).toEqual([]);
    });

    it('should not affect active subscriptions', () => {
      const pubsub = new PubSub<string>();
      const received: string[] = [];
      pubsub.subscribe('test', (msg) => received.push(msg));
      pubsub.clearHistory();
      pubsub.publish('test', 'still-delivered');
      expect(received).toEqual(['still-delivered']);
    });

    it('should allow history to accumulate again after clear', () => {
      const pubsub = new PubSub<number>({ maxHistory: 3 });
      pubsub.publish('counter', 1);
      pubsub.clearHistory();
      pubsub.publish('counter', 2);
      expect(pubsub.getHistory('counter')).toEqual([2]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string topic as an exact subscription', () => {
      const pubsub = new PubSub<string>();
      const received: string[] = [];
      pubsub.subscribe('', (msg) => received.push(msg));
      pubsub.publish('', 'empty-topic');
      pubsub.publish('other', 'not-received');
      expect(received).toEqual(['empty-topic']);
    });

    it('should handle empty string topic with hasSubscribers', () => {
      const pubsub = new PubSub();
      expect(pubsub.hasSubscribers('')).toBe(false);
      pubsub.subscribe('', () => {});
      expect(pubsub.hasSubscribers('')).toBe(true);
    });

    it('should match ** wildcard at start of remaining pattern (stops at first **)', () => {
      // matchWildcard returns true immediately on **, so 'a.**.b.**.c'
      // matches any topic starting with 'a.' because ** short-circuits
      const pubsub = new PubSub<string>();
      const received: string[] = [];
      pubsub.subscribe('a.**.b.**.c', (msg) => received.push(msg));
      pubsub.publish('a.x', 'matched');        // ** at pos 1 matches rest
      pubsub.publish('a.b.c', 'also-matched'); // ** at pos 1 matches rest
      pubsub.publish('b.x', 'not-matched');    // first segment mismatch
      expect(received).toEqual(['matched', 'also-matched']);
    });

    it('should allow calling off() from within an emit callback without skipping other subscribers', () => {
      const pubsub = new PubSub<string>();
      const received: string[] = [];

      // sub1 unsubscribes itself during the emit
      const unsub1 = pubsub.subscribe('test', () => {
        unsub1();
        received.push('sub1');
      });
      pubsub.subscribe('test', () => received.push('sub2'));

      pubsub.publish('test', 'trigger');
      // Both listeners should have fired on this publish
      expect(received).toContain('sub1');
      expect(received).toContain('sub2');

      // sub1 should be gone on next publish
      received.length = 0;
      pubsub.publish('test', 'trigger2');
      expect(received).toEqual(['sub2']);
  describe('listener exception isolation', () => {
    it('should propagate the exception and halt delivery to subsequent listeners', () => {
      // The current implementation does NOT isolate listener exceptions:
      // a throw in the first listener aborts the iteration, so later listeners
      // registered on the same topic never execute.
      const pubsub = new PubSub<string>();
      const received: string[] = [];

      pubsub.subscribe('test', () => {
        throw new Error('listener error');
      });
      pubsub.subscribe('test', (msg) => received.push(msg));

      expect(() => pubsub.publish('test', 'hello')).toThrow('listener error');
      // Second listener was not reached because the first threw
      expect(received).toEqual([]);
    });
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

  it('off() should remove the specific listener', () => {
    interface Events {
      tick: number;
    }

    const emitter = new EventEmitter<Events>();
    const received: number[] = [];
    const listener = (n: number) => received.push(n);

    emitter.on('tick', listener);
    emitter.emit('tick', 1);
    emitter.off('tick', listener);
    emitter.emit('tick', 2);

    expect(received).toEqual([1]);
  });

  it('off() should clean up listenerMap so re-adding the same function works as a fresh subscription', () => {
    interface Events {
      tick: number;
    }

    const emitter = new EventEmitter<Events>();
    const received: number[] = [];
    const listener = (n: number) => received.push(n);

    emitter.on('tick', listener);
    emitter.emit('tick', 1);
    emitter.off('tick', listener);

    // Re-add the same function reference — should receive events again
    emitter.on('tick', listener);
    emitter.emit('tick', 2);
    emitter.off('tick', listener);
    emitter.emit('tick', 3);

    expect(received).toEqual([1, 2]);
  });

  it('off() should not throw when called with an unknown listener', () => {
    interface Events {
      tick: number;
    }

    const emitter = new EventEmitter<Events>();
    const listener = (_n: number) => {};

    expect(() => emitter.off('tick', listener)).not.toThrow();
  });

  it('off() should not affect other listeners on the same event', () => {
    interface Events {
      tick: number;
    }

    const emitter = new EventEmitter<Events>();
    const receivedA: number[] = [];
    const receivedB: number[] = [];
    const listenerA = (n: number) => receivedA.push(n);
    const listenerB = (n: number) => receivedB.push(n);

    emitter.on('tick', listenerA);
    emitter.on('tick', listenerB);
    emitter.emit('tick', 1);
    emitter.off('tick', listenerA);
    emitter.emit('tick', 2);

    expect(receivedA).toEqual([1]);
    expect(receivedB).toEqual([1, 2]);
  });

  it('off() cleans up listenerMap for many add/remove cycles without unbounded growth', () => {
    interface Events {
      data: string;
    }

    const emitter = new EventEmitter<Events>();
    const received: string[] = [];

    for (let i = 0; i < 1000; i++) {
      const listener = (msg: string) => received.push(msg);
      emitter.on('data', listener);
      emitter.off('data', listener);
    }

    // After all add/remove cycles, no listeners should remain
    emitter.emit('data', 'after');
    expect(received).toEqual([]);

    // Internal listenerMap should have no entry for 'data'
    // (verified indirectly: re-adding works and only fires once)
    const finalReceived: string[] = [];
    const finalListener = (msg: string) => finalReceived.push(msg);
    emitter.on('data', finalListener);
    emitter.emit('data', 'final');
    emitter.off('data', finalListener);
    emitter.emit('data', 'gone');

    expect(finalReceived).toEqual(['final']);
  });
});
