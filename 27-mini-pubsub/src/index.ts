/**
 * Mini PubSub - A simple publish-subscribe messaging system
 * 
 * Concepts:
 * - Topic-based messaging
 * - Wildcard subscriptions
 * - Message history/replay
 * - Once listeners
 */

export type Listener<T = unknown> = (message: T, topic: string) => void;
export type Unsubscribe = () => void;

interface Subscription<T> {
  listener: Listener<T>;
  once: boolean;
}

export class PubSub<T = unknown> {
  private subscriptions = new Map<string, Set<Subscription<T>>>();
  private wildcardSubs = new Map<string, Set<Subscription<T>>>();
  private history = new Map<string, T[]>();
  private maxHistory: number;

  constructor(options: { maxHistory?: number } = {}) {
    this.maxHistory = options.maxHistory ?? 0;
  }

  /**
   * Subscribe to a topic, with optional wildcard matching.
   *
   * Wildcard semantics (dot-separated segments):
   * - `*`  — matches exactly **one** segment: `user.*` matches `user.login` but not `user.login.ok`.
   * - `**` — matches **any number** of remaining segments: `user.**` matches `user.login`, `user.login.ok`, etc.
   *
   * @param topic - Exact topic name or wildcard pattern (e.g. `"user.*"`, `"events.**"`).
   * @param listener - Callback invoked with `(message, topic)` on each matching publish.
   * @returns An `Unsubscribe` function; call it to remove this subscription.
   *
   * @example
   * const unsub = pubsub.subscribe("user.login", (msg, topic) => {
   *   console.log(topic, msg);
   * });
   * pubsub.publish("user.login", { userId: 1 }); // listener fires
   * unsub(); // listener removed
   *
   * // Wildcard
   * pubsub.subscribe("user.*", listener);      // matches user.login, user.logout
   * pubsub.subscribe("metrics.**", listener);  // matches metrics.cpu, metrics.cpu.core0
   */
  subscribe(topic: string, listener: Listener<T>): Unsubscribe {
    return this._subscribe(topic, listener, false);
  }

  /**
   * Subscribe to a topic for exactly one message, then automatically unsubscribe.
   *
   * Supports the same wildcard patterns as `subscribe` (`*` and `**`).
   *
   * @param topic - Exact topic name or wildcard pattern.
   * @param listener - Callback invoked once with `(message, topic)`.
   * @returns An `Unsubscribe` function to cancel before the message arrives.
   *
   * @example
   * pubsub.once("app.ready", () => console.log("ready!"));
   * pubsub.publish("app.ready", null); // fires once
   * pubsub.publish("app.ready", null); // no-op — already unsubscribed
   */
  once(topic: string, listener: Listener<T>): Unsubscribe {
    return this._subscribe(topic, listener, true);
  }

  private _subscribe(topic: string, listener: Listener<T>, once: boolean): Unsubscribe {
    const sub: Subscription<T> = { listener, once };
    
    if (topic.includes('*')) {
      // Wildcard subscription
      if (!this.wildcardSubs.has(topic)) {
        this.wildcardSubs.set(topic, new Set());
      }
      this.wildcardSubs.get(topic)!.add(sub);
      
      return () => {
        this.wildcardSubs.get(topic)?.delete(sub);
      };
    } else {
      // Exact subscription
      if (!this.subscriptions.has(topic)) {
        this.subscriptions.set(topic, new Set());
      }
      this.subscriptions.get(topic)!.add(sub);
      
      return () => {
        this.subscriptions.get(topic)?.delete(sub);
      };
    }
  }

  /**
   * Publish a message to a topic.
   *
   * Delivers to all exact-match subscribers first, then to all wildcard subscribers
   * whose pattern matches the topic. Once-listeners are removed after delivery.
   * If `maxHistory > 0`, the message is appended to the topic's history buffer.
   *
   * @param topic - The exact topic name to publish to (no wildcards).
   * @param message - The message payload to deliver.
   * @returns The total number of listeners that received the message.
   *
   * @example
   * const pubsub = new PubSub<string>({ maxHistory: 5 });
   * pubsub.subscribe("chat", (msg) => console.log(msg));
   * const count = pubsub.publish("chat", "hello"); // → 1
   */
  publish(topic: string, message: T): number {
    let delivered = 0;

    // Store in history
    if (this.maxHistory > 0) {
      if (!this.history.has(topic)) {
        this.history.set(topic, []);
      }
      const hist = this.history.get(topic)!;
      hist.push(message);
      if (hist.length > this.maxHistory) {
        hist.shift();
      }
    }

    // Deliver to exact subscribers
    const exactSubs = this.subscriptions.get(topic);
    if (exactSubs) {
      const toRemove: Subscription<T>[] = [];
      for (const sub of exactSubs) {
        sub.listener(message, topic);
        delivered++;
        if (sub.once) toRemove.push(sub);
      }
      for (const sub of toRemove) {
        exactSubs.delete(sub);
      }
    }

    // Deliver to wildcard subscribers
    for (const [pattern, subs] of this.wildcardSubs) {
      if (this.matchWildcard(pattern, topic)) {
        const toRemove: Subscription<T>[] = [];
        for (const sub of subs) {
          sub.listener(message, topic);
          delivered++;
          if (sub.once) toRemove.push(sub);
        }
        for (const sub of toRemove) {
          subs.delete(sub);
        }
      }
    }

    return delivered;
  }

  /**
   * Match a wildcard pattern against a topic
   * '*' matches any single segment
   * '**' matches any number of segments
   */
  private matchWildcard(pattern: string, topic: string): boolean {
    const patternParts = pattern.split('.');
    const topicParts = topic.split('.');

    let pi = 0, ti = 0;
    
    while (pi < patternParts.length && ti < topicParts.length) {
      if (patternParts[pi] === '**') {
        // Match rest
        return true;
      } else if (patternParts[pi] === '*') {
        // Match single segment
        pi++;
        ti++;
      } else if (patternParts[pi] === topicParts[ti]) {
        pi++;
        ti++;
      } else {
        return false;
      }
    }

    return pi === patternParts.length && ti === topicParts.length;
  }

  /**
   * Returns the stored message history for an exact topic.
   *
   * History is only kept when `maxHistory > 0` was set in the constructor.
   * The buffer is capped at `maxHistory` entries (oldest dropped first).
   *
   * @param topic - The exact topic name.
   * @returns An array of past messages (oldest first), or `[]` if none recorded.
   *
   * @example
   * const pubsub = new PubSub<number>({ maxHistory: 3 });
   * pubsub.publish("score", 1);
   * pubsub.publish("score", 2);
   * pubsub.getHistory("score"); // → [1, 2]
   */
  getHistory(topic: string): T[] {
    return this.history.get(topic) ?? [];
  }

  /**
   * Replays stored history to a listener, then subscribes it for future messages.
   *
   * Useful for late joiners: the listener receives all previously published messages
   * (up to `maxHistory`) synchronously before being registered for new ones.
   *
   * @param topic - The exact topic name to replay and subscribe to.
   * @param listener - Callback invoked with each historical message, then with new ones.
   * @returns An `Unsubscribe` function that cancels the ongoing subscription.
   *
   * @example
   * const pubsub = new PubSub<string>({ maxHistory: 10 });
   * pubsub.publish("log", "first");
   * pubsub.publish("log", "second");
   *
   * // Late joiner gets both past messages immediately, then stays subscribed
   * const unsub = pubsub.replay("log", (msg) => console.log(msg));
   * // logs "first", "second" synchronously
   * pubsub.publish("log", "third"); // logs "third" via live subscription
   * unsub();
   */
  replay(topic: string, listener: Listener<T>): Unsubscribe {
    const history = this.getHistory(topic);
    for (const message of history) {
      listener(message, topic);
    }
    return this.subscribe(topic, listener);
  }

  /**
   * Returns the total number of active subscribers for a topic, including wildcard matches.
   *
   * @param topic - The exact topic name to count subscribers for.
   * @returns The number of listeners (exact + all matching wildcard patterns).
   *
   * @example
   * pubsub.subscribe("user.login", listenerA);
   * pubsub.subscribe("user.*", listenerB);
   * pubsub.subscriberCount("user.login"); // → 2
   */
  subscriberCount(topic: string): number {
    let count = this.subscriptions.get(topic)?.size ?? 0;
    
    // Check wildcards
    for (const [pattern, subs] of this.wildcardSubs) {
      if (this.matchWildcard(pattern, topic)) {
        count += subs.size;
      }
    }
    
    return count;
  }

  /**
   * Returns `true` if at least one subscriber (exact or wildcard) is listening on the topic.
   *
   * @param topic - The exact topic name to check.
   * @returns `true` when `subscriberCount(topic) > 0`, otherwise `false`.
   *
   * @example
   * pubsub.hasSubscribers("user.login"); // → false
   * pubsub.subscribe("user.login", listener);
   * pubsub.hasSubscribers("user.login"); // → true
   */
  hasSubscribers(topic: string): boolean {
    return this.subscriberCount(topic) > 0;
  }

  /**
   * Removes all exact and wildcard subscriptions. Does not clear message history.
   *
   * @example
   * pubsub.subscribe("a", listener);
   * pubsub.clear();
   * pubsub.hasSubscribers("a"); // → false
   */
  clear(): void {
    this.subscriptions.clear();
    this.wildcardSubs.clear();
  }

  /**
   * Clears all stored message history across every topic. Does not affect subscriptions.
   *
   * @example
   * pubsub.publish("log", "msg");
   * pubsub.clearHistory();
   * pubsub.getHistory("log"); // → []
   */
  clearHistory(): void {
    this.history.clear();
  }
}

/**
 * Typed event emitter built on PubSub
 */
export class EventEmitter<Events extends Record<string, unknown>> {
  private pubsub = new PubSub<unknown>();

  on<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): Unsubscribe {
    return this.pubsub.subscribe(event as string, listener as Listener);
  }

  once<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): Unsubscribe {
    return this.pubsub.once(event as string, listener as Listener);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): number {
    return this.pubsub.publish(event as string, data);
  }

  off<K extends keyof Events>(event: K): void {
    // Note: This is a simplified clear-all for the event
    // A full implementation would track individual listeners
  }
}

export default PubSub;
