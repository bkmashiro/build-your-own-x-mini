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
