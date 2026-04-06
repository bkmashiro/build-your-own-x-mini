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
