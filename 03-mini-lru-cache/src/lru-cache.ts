import { createNode, DoublyLinkedList, type ListNode } from "./doubly-linked-list.js";

export class LRUCache<K, V> {
  private readonly capacity: number;
  private readonly items = new Map<K, ListNode<K, V>>();
  private readonly list = new DoublyLinkedList<K, V>();

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("capacity must be a positive integer");
    }

    this.capacity = capacity;
  }

  get(key: K): V | undefined {
    const node = this.items.get(key);

    if (node === undefined) {
      return undefined;
    }

    this.list.moveToFront(node);
    return node.value;
  }

  put(key: K, value: V): void {
    const existing = this.items.get(key);

    if (existing !== undefined) {
      existing.value = value;
      this.list.moveToFront(existing);
      return;
    }

    const node = createNode(key, value);
    this.list.addToFront(node);
    this.items.set(key, node);

    if (this.items.size > this.capacity) {
      const evicted = this.list.removeTail();

      if (evicted !== undefined) {
        this.items.delete(evicted.key);
      }
    }
  }

  delete(key: K): boolean {
    const node = this.items.get(key);

    if (node === undefined) {
      return false;
    }

    this.list.remove(node);
    return this.items.delete(key);
  }

  has(key: K): boolean {
    return this.items.has(key);
  }

  size(): number {
    return this.items.size;
  }

  keys(): K[] {
    return this.list.toArray().map((node: ListNode<K, V>) => node.key);
  }

  values(): V[] {
    return this.list.toArray().map((node: ListNode<K, V>) => node.value);
  }

  entries(): Array<[K, V]> {
    return this.list.toArray().map((node: ListNode<K, V>) => [node.key, node.value]);
  }
}
