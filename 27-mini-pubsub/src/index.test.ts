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

  it('should return 0 delivery count when publishing to topic with no subscribers', () => {
    const pubsub = new PubSub<string>();

    const count = pubsub.publish('empty', 'hello');
    expect(count).toBe(0);
  });

  describe('clear()', () => {
    it('should remove all subscribers so subscriberCount returns 0', () => {
      const pubsub = new PubSub<string>();

      pubsub.subscribe('topic.a', () => {});
      pubsub.subscribe('topic.b', () => {});
      pubsub.subscribe('topic.*', () => {});

      pubsub.clear();

      expect(pubsub.subscriberCount('topic.a')).toBe(0);
      expect(pubsub.subscriberCount('topic.b')).toBe(0);
    });

    it('should stop delivering messages after clear', () => {
      const pubsub = new PubSub<string>();
      const received: string[] = [];

      pubsub.subscribe('test', (msg) => received.push(msg));
      pubsub.clear();
      pubsub.publish('test', 'after-clear');

      expect(received).toEqual([]);
    });
  });

  describe('clearHistory()', () => {
    it('should reset stored history so replay does not receive old messages', () => {
      const pubsub = new PubSub<string>({ maxHistory: 10 });
      const received: string[] = [];

      pubsub.publish('log', 'old1');
      pubsub.publish('log', 'old2');
      pubsub.clearHistory();

      pubsub.replay('log', (msg) => received.push(msg));

      expect(received).toEqual([]);
    });

    it('should allow new messages to be stored after clearHistory', () => {
      const pubsub = new PubSub<string>({ maxHistory: 10 });

      pubsub.publish('log', 'old');
      pubsub.clearHistory();
      pubsub.publish('log', 'new');

      expect(pubsub.getHistory('log')).toEqual(['new']);
    });
  });

  describe('hasSubscribers()', () => {
    it('should return false on an empty bus', () => {
      const pubsub = new PubSub<string>();

      expect(pubsub.hasSubscribers('test')).toBe(false);
    });

    it('should return true after subscribing', () => {
      const pubsub = new PubSub<string>();

      pubsub.subscribe('test', () => {});

      expect(pubsub.hasSubscribers('test')).toBe(true);
    });

    it('should return false after unsubscribing the last subscriber', () => {
      const pubsub = new PubSub<string>();

      const unsub = pubsub.subscribe('test', () => {});
      unsub();

      expect(pubsub.hasSubscribers('test')).toBe(false);
    });

    it('should account for wildcard subscribers matching the topic', () => {
      const pubsub = new PubSub<string>();

      pubsub.subscribe('user.*', () => {});

      expect(pubsub.hasSubscribers('user.login')).toBe(true);
      expect(pubsub.hasSubscribers('system.start')).toBe(false);
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
});
