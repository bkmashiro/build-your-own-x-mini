/**
 * 13-mini-lru-cache
 *
 * O(1) LRU Cache implemented with a HashMap + Doubly Linked List.
 *
 * - HashMap<K, Node<K,V>>  → O(1) lookup by key
 * - DLL keeps access order: head = MRU, tail = LRU
 * - On get/put: move accessed node to head
 * - On capacity overflow: evict tail (LRU)
 */

interface DLLNode<K, V> {
  key: K;
  value: V;
  prev: DLLNode<K, V> | null;
  next: DLLNode<K, V> | null;
}

function createNode<K, V>(key: K, value: V): DLLNode<K, V> {
  return { key, value, prev: null, next: null };
}

export class LRUCache<K, V> {
  private readonly capacity: number;
  private readonly map: Map<K, DLLNode<K, V>>;

  // Sentinel nodes — head.next = MRU, tail.prev = LRU
  private readonly head: DLLNode<K, V>;
  private readonly tail: DLLNode<K, V>;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new RangeError(`LRUCache capacity must be a positive integer, got ${capacity}`);
    }
    this.capacity = capacity;
    this.map = new Map();

    // Sentinels use a dummy key/value; they are never exposed externally
    this.head = createNode<K, V>(null as unknown as K, null as unknown as V);
    this.tail = createNode<K, V>(null as unknown as K, null as unknown as V);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  /** Return the size (number of cached entries). */
  get size(): number {
    return this.map.size;
  }

  /**
   * Get the value for `key`.
   * Marks the entry as most-recently-used.
   * Returns `undefined` if not found.
   */
  get(key: K): V | undefined {
    const node = this.map.get(key);
    if (node === undefined) return undefined;
    this.moveToFront(node);
    return node.value;
  }

  /**
   * Insert or update `key` with `value`.
   * Evicts the least-recently-used entry when over capacity.
   */
  put(key: K, value: V): void {
    const existing = this.map.get(key);
    if (existing !== undefined) {
      existing.value = value;
      this.moveToFront(existing);
      return;
    }

    const node = createNode(key, value);
    this.map.set(key, node);
    this.insertAtFront(node);

    if (this.map.size > this.capacity) {
      this.evictLRU();
    }
  }

  /**
   * Check whether `key` exists without changing access order.
   */
  has(key: K): boolean {
    return this.map.has(key);
  }

  /**
   * Delete an entry by key.
   * Returns `true` if the entry existed.
   */
  delete(key: K): boolean {
    const node = this.map.get(key);
    if (node === undefined) return false;
    this.removeNode(node);
    this.map.delete(key);
    return true;
  }

  /** Remove all entries. */
  clear(): void {
    this.map.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  /**
   * Return keys in MRU → LRU order (most-recently-used first).
   */
  keys(): K[] {
    const result: K[] = [];
    let cur = this.head.next;
    while (cur !== this.tail) {
      result.push(cur!.key);
      cur = cur!.next;
    }
    return result;
  }

  /**
   * Return [key, value] pairs in MRU → LRU order.
   */
  entries(): [K, V][] {
    const result: [K, V][] = [];
    let cur = this.head.next;
    while (cur !== this.tail) {
      result.push([cur!.key, cur!.value]);
      cur = cur!.next;
    }
    return result;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private insertAtFront(node: DLLNode<K, V>): void {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next!.prev = node;
    this.head.next = node;
  }

  private removeNode(node: DLLNode<K, V>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
    node.prev = null;
    node.next = null;
  }

  private moveToFront(node: DLLNode<K, V>): void {
    this.removeNode(node);
    this.insertAtFront(node);
  }

  private evictLRU(): void {
    const lru = this.tail.prev!;
    // lru should never be the head sentinel because capacity >= 1
    this.removeNode(lru);
    this.map.delete(lru.key);
  }
}
