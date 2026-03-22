# 03-mini-lru-cache

一个使用 `HashMap + Doubly Linked List` 实现的泛型 LRU Cache，`get` / `put` / `delete` 都保持 `O(1)`。

## API

```ts
new LRUCache<K, V>(capacity: number)
get(key: K): V | undefined
put(key: K, value: V): void
delete(key: K): boolean
has(key: K): boolean
size(): number
keys(): K[]
values(): V[]
entries(): [K, V][]
```

## Design

- `Map<K, Node<K, V>>` 负责 `O(1)` 定位节点。
- 双向链表维护访问顺序，表头是最近使用，表尾是最久未使用。
- `get` 命中后把节点移动到表头。
- `put` 超过容量时自动淘汰表尾节点，避免无限增长。

## Usage

```ts
import { LRUCache } from "./src/lru-cache";

const cache = new LRUCache<string, number>(2);

cache.put("a", 1);
cache.put("b", 2);
cache.get("a");
cache.put("c", 3);

console.log(cache.entries()); // [["c", 3], ["a", 1]]
```

## Run

```bash
npm install
npm test
npm run demo
```
