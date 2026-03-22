import { LRUCache } from "./src/lru-cache.js";

const cache = new LRUCache<string, number>(2);

cache.put("a", 1);
cache.put("b", 2);
console.log("after put(a, b):", cache.entries());

cache.get("a");
console.log("after get(a):", cache.entries());

cache.put("c", 3);
console.log("after put(c):", cache.entries());

console.log("has(b):", cache.has("b"));
console.log("keys:", cache.keys());
console.log("values:", cache.values());
