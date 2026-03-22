import { describe, expect, it } from "vitest";

import { LRUCache } from "../src/lru-cache.js";

describe("LRUCache", () => {
  it("returns undefined for missing keys", () => {
    const cache = new LRUCache<string, number>(2);

    expect(cache.get("missing")).toBeUndefined();
    expect(cache.has("missing")).toBe(false);
  });

  it("stores and retrieves values", () => {
    const cache = new LRUCache<string, number>(2);

    cache.put("a", 1);
    cache.put("b", 2);

    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBe(2);
    expect(cache.size()).toBe(2);
  });

  it("moves accessed items to the front", () => {
    const cache = new LRUCache<string, number>(3);

    cache.put("a", 1);
    cache.put("b", 2);
    cache.put("c", 3);
    cache.get("a");

    expect(cache.keys()).toEqual(["a", "c", "b"]);
    expect(cache.values()).toEqual([1, 3, 2]);
    expect(cache.entries()).toEqual([
      ["a", 1],
      ["c", 3],
      ["b", 2],
    ]);
  });

  it("updates existing keys without growing the cache", () => {
    const cache = new LRUCache<string, number>(2);

    cache.put("a", 1);
    cache.put("b", 2);
    cache.put("a", 10);

    expect(cache.size()).toBe(2);
    expect(cache.get("a")).toBe(10);
    expect(cache.keys()).toEqual(["a", "b"]);
  });

  it("evicts the least recently used item when capacity is exceeded", () => {
    const cache = new LRUCache<string, number>(2);

    cache.put("a", 1);
    cache.put("b", 2);
    cache.get("a");
    cache.put("c", 3);

    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
    expect(cache.keys()).toEqual(["c", "a"]);
  });

  it("deletes items safely", () => {
    const cache = new LRUCache<string, number>(2);

    cache.put("a", 1);
    cache.put("b", 2);

    expect(cache.delete("a")).toBe(true);
    expect(cache.delete("a")).toBe(false);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size()).toBe(1);
    expect(cache.keys()).toEqual(["b"]);
  });

  it("supports generic object keys", () => {
    const keyA = { id: "a" };
    const keyB = { id: "b" };
    const keyC = { id: "c" };
    const cache = new LRUCache<{ id: string }, string>(2);

    cache.put(keyA, "alpha");
    cache.put(keyB, "beta");
    cache.get(keyA);
    cache.put(keyC, "gamma");

    expect(cache.get(keyA)).toBe("alpha");
    expect(cache.get(keyB)).toBeUndefined();
    expect(cache.get(keyC)).toBe("gamma");
  });

  it("rejects invalid capacities", () => {
    expect(() => new LRUCache<string, number>(0)).toThrowError(
      "capacity must be a positive integer",
    );
    expect(() => new LRUCache<string, number>(1.5)).toThrowError(
      "capacity must be a positive integer",
    );
  });
});
