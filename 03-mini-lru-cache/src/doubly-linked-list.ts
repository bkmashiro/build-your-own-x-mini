export interface ListNode<K, V> {
  key: K;
  value: V;
  prev: ListNode<K, V> | null;
  next: ListNode<K, V> | null;
}

export class DoublyLinkedList<K, V> {
  private head: ListNode<K, V> | null = null;
  private tail: ListNode<K, V> | null = null;
  private length = 0;

  addToFront(node: ListNode<K, V>): void {
    node.prev = null;
    node.next = this.head;

    if (this.head !== null) {
      this.head.prev = node;
    } else {
      this.tail = node;
    }

    this.head = node;
    this.length += 1;
  }

  moveToFront(node: ListNode<K, V>): void {
    if (node === this.head) {
      return;
    }

    this.remove(node);
    this.addToFront(node);
  }

  remove(node: ListNode<K, V>): void {
    if (node.prev !== null) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next !== null) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    node.prev = null;
    node.next = null;
    this.length -= 1;
  }

  removeTail(): ListNode<K, V> | undefined {
    if (this.tail === null) {
      return undefined;
    }

    const tail = this.tail;
    this.remove(tail);
    return tail;
  }

  size(): number {
    return this.length;
  }

  toArray(): Array<ListNode<K, V>> {
    const nodes: Array<ListNode<K, V>> = [];
    let current = this.head;

    while (current !== null) {
      nodes.push(current);
      current = current.next;
    }

    return nodes;
  }
}

export function createNode<K, V>(key: K, value: V): ListNode<K, V> {
  return {
    key,
    value,
    prev: null,
    next: null,
  };
}
