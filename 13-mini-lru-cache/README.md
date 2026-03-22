# 13-mini-lru-cache

> Build Your Own X · Mini Series

A from-scratch **LRU (Least-Recently-Used) Cache** in TypeScript, with `O(1)` get and put operations.

---

## Data Structure

```
HashMap<K, DLLNode<K,V>>    →  O(1) key lookup / delete
Doubly Linked List (DLL)    →  O(1) move-to-front, evict-tail

head ↔ [MRU] ↔ ... ↔ [LRU] ↔ tail
```

- **HashMap** maps every key to its node in the list — no scanning needed.
- **DLL** maintains access order; sentinel `head`/`tail` nodes eliminate null-checks on the boundary.
- `get(key)` → find node in map, unlink & reinsert at head.
- `put(key, val)` → insert at head; if over capacity, evict `tail.prev`.

Both operations touch a constant number of pointers: **O(1) time**, **O(capacity) space**.

---

## API

```ts
import { LRUCache } from "./src/index";

const cache = new LRUCache<number, string>(3); // capacity = 3

cache.put(1, "one");
cache.put(2, "two");
cache.put(3, "three");

cache.get(1);          // "one"  — key 1 is now MRU

cache.put(4, "four");  // evicts key 2 (LRU)
cache.get(2);          // undefined

cache.has(3);          // true  (no recency change)
cache.delete(3);       // true
cache.size;            // 2

cache.keys();          // [4, 1]  (MRU → LRU)
cache.entries();       // [[4,"four"], [1,"one"]]

cache.clear();
```

### Constructor

| Signature | Description |
|-----------|-------------|
| `new LRUCache<K, V>(capacity: number)` | Create a cache; throws `RangeError` if `capacity ≤ 0` |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `get(key)` | `V \| undefined` | Fetch value; marks as MRU |
| `put(key, value)` | `void` | Insert/update; evicts LRU if over capacity |
| `has(key)` | `boolean` | Check presence without changing order |
| `delete(key)` | `boolean` | Remove entry; returns whether it existed |
| `clear()` | `void` | Remove all entries |
| `keys()` | `K[]` | Keys in MRU → LRU order |
| `entries()` | `[K,V][]` | Key-value pairs in MRU → LRU order |
| `size` | `number` | Current number of entries |

---

## Running

```bash
npm install
npm test            # run all tests
npm run test:coverage
npm run build       # compile to dist/
```

---

## Tests

| Suite | What it covers |
|-------|---------------|
| Construction | empty cache, invalid capacity |
| get / put | miss, hit, update, size tracking |
| Eviction | basic eviction, get/put refreshes recency, capacity=1 |
| has / delete / clear | semantics, order isolation, post-clear reuse |
| keys() / entries() | MRU→LRU ordering |
| Generics | string/object/symbol key types |
| LeetCode-146 | classic interview scenario |
| Stress | 10 000 random ops, size invariant |

---

## Complexity

| Operation | Time | Space |
|-----------|------|-------|
| `get` | O(1) | O(1) |
| `put` | O(1) | O(capacity) total |
| `delete` | O(1) | O(1) |
| `has` | O(1) | O(1) |

---

## Key Insight

The trick is keeping the HashMap and the DLL in sync:

1. The map gives you the node in **O(1)** — no traversal.
2. Having a pointer to the node lets you unlink it from the DLL in **O(1)** (you know both `prev` and `next`).
3. Relinking at the head is **O(1)** pointer surgery.

Without the map you'd need O(n) to find the node.  
Without the DLL you'd need O(n) to maintain order.  
Together: O(1) for everything.
