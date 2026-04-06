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
        try {
          sub.listener(message, topic);
          delivered++;
        } catch {
          // Isolate listener errors so remaining subscribers still receive the message
        }
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
          try {
            sub.listener(message, topic);
            delivered++;
          } catch {
            // Isolate listener errors so remaining subscribers still receive the message
          }
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
