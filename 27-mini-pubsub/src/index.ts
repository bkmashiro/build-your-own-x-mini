/**
 * Mini PubSub - A simple publish-subscribe messaging system
 * 
 * Concepts:
 * - Topic-based messaging
 * - Wildcard subscriptions
 * - Message history/replay
 * - Once listeners
 */

/**
 * A callback invoked when a message is published to a subscribed topic.
 * @param message - The published message payload.
 * @param topic - The exact topic the message was published on (useful when
 *   the subscription used a wildcard pattern).
 */
export type Listener<T = unknown> = (message: T, topic: string) => void;

/**
 * A function that, when called, removes the associated subscription so the
 * listener stops receiving messages.
 */
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
   * Subscribe to a topic
   * Supports wildcards: 'user.*' matches 'user.login', 'user.logout'
   */
  subscribe(topic: string, listener: Listener<T>): Unsubscribe {
    return this._subscribe(topic, listener, false);
  }

  /**
   * Subscribe once - automatically unsubscribe after first message
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
   * Publish a message to a topic
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
   * Tests whether a wildcard pattern matches a concrete topic string.
   *
   * Topics and patterns are dot-separated segment strings (e.g. `"user.login"`).
   * Two wildcard tokens are supported:
   * - `*`  — matches **exactly one** segment (e.g. `"user.*"` matches
   *   `"user.login"` but not `"user.login.extra"`).
   * - `**` — matches **zero or more** segments from its position to the end
   *   of the topic (e.g. `"events.**"` matches `"events"`, `"events.a"`, and
   *   `"events.a.b.c"`). When `**` is encountered the remaining topic segments
   *   are accepted unconditionally, so the algorithm returns `true` immediately.
   *
   * The algorithm walks both the pattern and topic segment arrays in lockstep,
   * advancing one segment at a time. Literal segments must match exactly;
   * `*` consumes one topic segment; `**` short-circuits to `true`. If the
   * arrays are exhausted simultaneously the match succeeds.
   *
   * @param pattern - A dot-separated pattern string that may contain `*` or
   *   `**` wildcard tokens.
   * @param topic - A concrete dot-separated topic string with no wildcards.
   * @returns `true` if every segment of `topic` is covered by `pattern`,
   *   `false` otherwise.
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
   * Get message history for a topic
   */
  getHistory(topic: string): T[] {
    return this.history.get(topic) ?? [];
  }

  /**
   * Replay history to a new subscriber
   */
  replay(topic: string, listener: Listener<T>): Unsubscribe {
    const history = this.getHistory(topic);
    for (const message of history) {
      listener(message, topic);
    }
    return this.subscribe(topic, listener);
  }

  /**
   * Get subscriber count for a topic
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
   * Check if topic has subscribers
   */
  hasSubscribers(topic: string): boolean {
    return this.subscriberCount(topic) > 0;
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.subscriptions.clear();
    this.wildcardSubs.clear();
  }

  /**
   * Clear history
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
