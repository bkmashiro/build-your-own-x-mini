import { LRUCache } from "../src/index";

// ─────────────────────────────────────────────────────────────────────────────
// Basic construction
// ─────────────────────────────────────────────────────────────────────────────
describe("LRUCache — construction", () => {
  it("creates an empty cache", () => {
    const c = new LRUCache<number, string>(3);
    expect(c.size).toBe(0);
  });

  it("throws for capacity <= 0", () => {
    expect(() => new LRUCache(0)).toThrow(RangeError);
    expect(() => new LRUCache(-1)).toThrow(RangeError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// get / put — basic semantics
// ─────────────────────────────────────────────────────────────────────────────
describe("LRUCache — get / put", () => {
  it("returns undefined for missing key", () => {
    const c = new LRUCache<number, number>(2);
    expect(c.get(1)).toBeUndefined();
  });

  it("stores and retrieves a value", () => {
    const c = new LRUCache<string, number>(2);
    c.put("a", 1);
    expect(c.get("a")).toBe(1);
  });

  it("updates an existing key", () => {
    const c = new LRUCache<string, number>(2);
    c.put("a", 1);
    c.put("a", 99);
    expect(c.get("a")).toBe(99);
    expect(c.size).toBe(1);
  });

  it("size tracks inserts correctly", () => {
    const c = new LRUCache<number, number>(5);
    c.put(1, 10);
    c.put(2, 20);
    expect(c.size).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Eviction
// ─────────────────────────────────────────────────────────────────────────────
describe("LRUCache — eviction", () => {
  it("evicts the LRU entry when capacity is exceeded", () => {
    const c = new LRUCache<number, number>(2);
    c.put(1, 1);
    c.put(2, 2);
    c.put(3, 3); // should evict key 1
    expect(c.get(1)).toBeUndefined();
    expect(c.get(2)).toBe(2);
    expect(c.get(3)).toBe(3);
  });

  it("a get() refreshes recency, preventing eviction", () => {
    const c = new LRUCache<number, number>(2);
    c.put(1, 1);
    c.put(2, 2);
    c.get(1);    // 1 is now MRU; 2 is LRU
    c.put(3, 3); // should evict key 2
    expect(c.get(2)).toBeUndefined();
    expect(c.get(1)).toBe(1);
    expect(c.get(3)).toBe(3);
  });

  it("a put() on existing key refreshes recency", () => {
    const c = new LRUCache<number, number>(2);
    c.put(1, 10);
    c.put(2, 20);
    c.put(1, 100); // refresh key 1; key 2 is now LRU
    c.put(3, 30);  // should evict key 2
    expect(c.get(2)).toBeUndefined();
    expect(c.get(1)).toBe(100);
    expect(c.get(3)).toBe(30);
  });

  it("evicts correctly with capacity 1", () => {
    const c = new LRUCache<number, number>(1);
    c.put(1, 1);
    c.put(2, 2);
    expect(c.get(1)).toBeUndefined();
    expect(c.get(2)).toBe(2);
  });

  it("never exceeds capacity", () => {
    const cap = 5;
    const c = new LRUCache<number, number>(cap);
    for (let i = 0; i < 20; i++) {
      c.put(i, i * 10);
      expect(c.size).toBeLessThanOrEqual(cap);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// has / delete / clear
// ─────────────────────────────────────────────────────────────────────────────
describe("LRUCache — has / delete / clear", () => {
  it("has() returns true for existing keys", () => {
    const c = new LRUCache<string, number>(3);
    c.put("x", 42);
    expect(c.has("x")).toBe(true);
    expect(c.has("y")).toBe(false);
  });

  it("has() does not change access order", () => {
    const c = new LRUCache<number, number>(2);
    c.put(1, 1);
    c.put(2, 2);
    c.has(1); // should NOT refresh key 1
    c.put(3, 3); // evicts LRU = key 1 (if has() doesn't update order)
    expect(c.get(1)).toBeUndefined();
  });

  it("delete() removes an entry and returns true", () => {
    const c = new LRUCache<string, number>(3);
    c.put("a", 1);
    expect(c.delete("a")).toBe(true);
    expect(c.get("a")).toBeUndefined();
    expect(c.size).toBe(0);
  });

  it("delete() returns false for missing key", () => {
    const c = new LRUCache<string, number>(3);
    expect(c.delete("nope")).toBe(false);
  });

  it("delete() doesn't disrupt other entries", () => {
    const c = new LRUCache<number, number>(3);
    c.put(1, 10);
    c.put(2, 20);
    c.put(3, 30);
    c.delete(2);
    expect(c.get(1)).toBe(10);
    expect(c.get(3)).toBe(30);
    expect(c.size).toBe(2);
  });

  it("clear() empties the cache", () => {
    const c = new LRUCache<number, number>(3);
    c.put(1, 1);
    c.put(2, 2);
    c.clear();
    expect(c.size).toBe(0);
    expect(c.get(1)).toBeUndefined();
  });

  it("cache is usable after clear()", () => {
    const c = new LRUCache<number, number>(2);
    c.put(1, 1);
    c.clear();
    c.put(2, 2);
    c.put(3, 3);
    expect(c.get(2)).toBe(2);
    expect(c.get(3)).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// keys() / entries() — order guarantee (MRU first)
// ─────────────────────────────────────────────────────────────────────────────
describe("LRUCache — keys() / entries()", () => {
  it("keys() returns keys in MRU → LRU order", () => {
    const c = new LRUCache<number, number>(3);
    c.put(1, 10);
    c.put(2, 20);
    c.put(3, 30); // order: 3, 2, 1
    expect(c.keys()).toEqual([3, 2, 1]);
  });

  it("get() moves key to front", () => {
    const c = new LRUCache<number, number>(3);
    c.put(1, 10);
    c.put(2, 20);
    c.put(3, 30);
    c.get(1); // order: 1, 3, 2
    expect(c.keys()).toEqual([1, 3, 2]);
  });

  it("entries() returns [key, value] pairs MRU → LRU", () => {
    const c = new LRUCache<string, number>(2);
    c.put("a", 1);
    c.put("b", 2);
    expect(c.entries()).toEqual([["b", 2], ["a", 1]]);
  });

  it("keys() returns empty array for empty cache", () => {
    const c = new LRUCache<number, number>(3);
    expect(c.keys()).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Generics — non-number key types
// ─────────────────────────────────────────────────────────────────────────────
describe("LRUCache — generic key/value types", () => {
  it("works with string keys and object values", () => {
    const c = new LRUCache<string, { score: number }>(2);
    c.put("alice", { score: 99 });
    c.put("bob", { score: 42 });
    expect(c.get("alice")?.score).toBe(99);
  });

  it("works with object keys (by reference)", () => {
    const c = new LRUCache<object, string>(2);
    const k1 = {};
    const k2 = {};
    c.put(k1, "val1");
    c.put(k2, "val2");
    expect(c.get(k1)).toBe("val1");
    expect(c.get(k2)).toBe("val2");
  });

  it("works with symbol keys", () => {
    const c = new LRUCache<symbol, number>(2);
    const s = Symbol("test");
    c.put(s, 123);
    expect(c.get(s)).toBe(123);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Stress / LeetCode-style scenario
// ─────────────────────────────────────────────────────────────────────────────
describe("LRUCache — LeetCode scenario (capacity=2)", () => {
  it("passes the classic LeetCode-146 example", () => {
    const c = new LRUCache<number, number>(2);
    c.put(1, 1);   // cache: {1=1}
    c.put(2, 2);   // cache: {1=1, 2=2}
    expect(c.get(1)).toBe(1);   // return 1; cache: {2=2, 1=1}
    c.put(3, 3);   // evicts key 2; cache: {1=1, 3=3}
    expect(c.get(2)).toBeUndefined(); // returns -1
    c.put(4, 4);   // evicts key 1; cache: {3=3, 4=4}
    expect(c.get(1)).toBeUndefined(); // returns -1
    expect(c.get(3)).toBe(3);
    expect(c.get(4)).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Large-scale stress test
// ─────────────────────────────────────────────────────────────────────────────
describe("LRUCache — stress test", () => {
  it("handles 10 000 operations without error", () => {
    const cap = 100;
    const c = new LRUCache<number, number>(cap);
    for (let i = 0; i < 10_000; i++) {
      const k = Math.floor(Math.random() * 200);
      if (Math.random() < 0.5) {
        c.put(k, k * 2);
      } else {
        c.get(k);
      }
      expect(c.size).toBeLessThanOrEqual(cap);
    }
  });
});
