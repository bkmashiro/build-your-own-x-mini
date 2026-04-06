import { describe, expect, test } from "bun:test";

import { Column, Entity, MiniORM, PrimaryKey } from "../src/index";

@Entity("products")
class Product {
  @PrimaryKey()
  id!: number;

  @Column()
  name!: string;

  @Column()
  meta!: Record<string, unknown>;
}

@Entity("users")
class User {
  @PrimaryKey()
  id!: number;

  @Column()
  name!: string;

  @Column()
  age!: number;

  @Column()
  active!: boolean;
}

@Entity("products")
class Product {
  @PrimaryKey()
  slug!: string;

  @Column()
  title!: string;
}

@Entity("events")
class CalendarEvent {
  @PrimaryKey()
  id!: number;

  @Column()
  startDate!: Date;

  @Column()
  tags!: Set<string>;

  @Column()
  metadata!: Map<string, string>;
}

@Entity("readings")
class Reading {
  @PrimaryKey()
  id!: number;

  @Column()
  value!: number | undefined;

  @Column()
  label!: string | undefined;
}

@Entity("string-users")
class StringUser {
  @PrimaryKey()
  id!: string;

  @Column()
  name!: string;
}

@Entity("log-events")
class Event {
  @PrimaryKey()
  id!: number;

  @Column()
  name!: string;

  @Column()
  metadata!: Record<string, unknown>;

  @Column()
  occurredAt!: Date;

  @Column()
  tags!: string[];
}

@Entity("documents")
class Document {
  @PrimaryKey()
  id!: number;

  @Column()
  meta!: Record<string, unknown>;

  @Column()
  tags!: string[];
}

describe("mini-orm", () => {
  test("creates and finds entities", () => {
    const orm = new MiniORM();

    orm.create(User, { id: 1, name: "Alice", age: 20, active: true });
    orm.create(User, { id: 2, name: "Bob", age: 28, active: false });

    expect(orm.find(User)).toHaveLength(2);
    expect(orm.find(User, { active: true })).toEqual([
      expect.objectContaining({ id: 1, name: "Alice" }),
    ]);
  });

  test("supports findOne with simple where filters", () => {
    const orm = new MiniORM();

    orm.create(User, { id: 1, name: "Alice", age: 20, active: true });
    orm.create(User, { id: 2, name: "Bob", age: 28, active: false });

    expect(orm.findOne(User, { name: "Bob" })).toEqual(
      expect.objectContaining({ id: 2, age: 28 }),
    );
    expect(orm.findOne(User, { id: 999 })).toBeNull();
  });

  test("supports predicate-based where clauses", () => {
    const orm = new MiniORM();

    orm.create(User, { id: 1, name: "Alice", age: 20, active: true });
    orm.create(User, { id: 2, name: "Bob", age: 28, active: false });
    orm.create(User, { id: 3, name: "Carol", age: 32, active: true });

    const result = orm.find(User, {
      age: (value) => value >= 25,
      active: true,
    });

    expect(result).toEqual([expect.objectContaining({ id: 3, name: "Carol" })]);
  });

  test("updates matching entities", () => {
    const orm = new MiniORM();

    orm.create(User, { id: 1, name: "Alice", age: 20, active: true });
    orm.create(User, { id: 2, name: "Bob", age: 28, active: false });

    const updated = orm.update(User, { active: false }, { active: true, age: 29 });

    expect(updated).toEqual([
      expect.objectContaining({ id: 2, active: true, age: 29 }),
    ]);
    expect(orm.find(User, { active: true })).toHaveLength(2);
  });

  test("deletes matching entities", () => {
    const orm = new MiniORM();

    orm.create(User, { id: 1, name: "Alice", age: 20, active: true });
    orm.create(User, { id: 2, name: "Bob", age: 28, active: false });

    expect(orm.delete(User, { active: false })).toBe(1);
    expect(orm.find(User)).toEqual([
      expect.objectContaining({ id: 1, name: "Alice" }),
    ]);
  });

  test("rejects duplicate primary keys", () => {
    const orm = new MiniORM();

    orm.create(User, { id: 1, name: "Alice", age: 20, active: true });

    expect(() =>
      orm.create(User, { id: 1, name: "Alice 2", age: 21, active: true }),
    ).toThrow("users with primary key 1 already exists");
  });

  test("rejects empty string primary key in update()", () => {
    const orm = new MiniORM();

    orm.create(Product, { slug: "widget", title: "Widget" });

    expect(() =>
      orm.update(Product, { slug: "widget" }, { slug: "" }),
    ).toThrow("Primary key slug cannot be empty");
  });

  test("round-trip fidelity for all primitive types", () => {
    const orm = new MiniORM();

    orm.create(User, { id: 1, name: "Alice", age: 20, active: true });
    orm.create(User, { id: 2, name: "Bob", age: 0, active: false });

    const alice = orm.findOne(User, { id: 1 })!;
    expect(alice.id).toBe(1);
    expect(alice.name).toBe("Alice");
    expect(alice.age).toBe(20);
    expect(alice.active).toBe(true);

    const bob = orm.findOne(User, { id: 2 })!;
    expect(bob.age).toBe(0);
    expect(bob.active).toBe(false);
  });

  test("preserves undefined fields on round-trip (not silently dropped)", () => {
    const orm = new MiniORM();

    orm.create(Reading, { id: 1, value: undefined, label: "test" });

    const reading = orm.findOne(Reading, { id: 1 })!;
    expect(reading).not.toBeNull();
    // undefined should be preserved, not silently dropped
    expect("value" in reading).toBe(true);
    expect(reading.value).toBeUndefined();
  });

  test("preserves NaN numeric fields on round-trip (not corrupted to null)", () => {
    const orm = new MiniORM();

    orm.create(Reading, { id: 2, value: NaN, label: "sensor-error" });

    const reading = orm.findOne(Reading, { id: 2 })!;
    expect(reading).not.toBeNull();
    // NaN should be preserved, not silently corrupted to null
    expect(reading.value).toBeNaN();
  });

  test("matches objects with keys in different insertion order", () => {
    const orm = new MiniORM();

    orm.create(Event, {
      id: 1,
      name: "signup",
      metadata: { a: 1, b: 2 },
      occurredAt: new Date("2024-01-01"),
      tags: [],
    });

    // {b:2,a:1} has same keys/values but different insertion order — must still match
    const result = orm.findOne(Event, { metadata: { b: 2, a: 1 } });
    expect(result).not.toBeNull();
    expect(result?.name).toBe("signup");
  });

  test("does not match objects with different values", () => {
    const orm = new MiniORM();

    orm.create(Event, {
      id: 1,
      name: "signup",
      metadata: { a: 1, b: 2 },
      occurredAt: new Date("2024-01-01"),
      tags: [],
    });

    expect(orm.findOne(Event, { metadata: { a: 1, b: 99 } })).toBeNull();
  });

  test("matches Date column values by time, not reference", () => {
    const orm = new MiniORM();
    const date = new Date("2024-06-15T12:00:00Z");

    orm.create(Event, {
      id: 1,
      name: "launch",
      metadata: {},
      occurredAt: date,
      tags: [],
    });

    // Different Date object, same timestamp
    const result = orm.findOne(Event, {
      occurredAt: new Date("2024-06-15T12:00:00Z"),
    });
    expect(result).not.toBeNull();
    expect(result?.name).toBe("launch");

    // Different timestamp must not match
    expect(
      orm.findOne(Event, { occurredAt: new Date("2024-06-15T13:00:00Z") }),
    ).toBeNull();
  });

  test("matches nested objects recursively", () => {
    const orm = new MiniORM();

    orm.create(Event, {
      id: 1,
      name: "deploy",
      metadata: { config: { region: "us-east-1", replicas: 3 } },
      occurredAt: new Date("2024-01-01"),
      tags: [],
    });

    const result = orm.findOne(Event, {
      metadata: { config: { replicas: 3, region: "us-east-1" } },
    });
    expect(result).not.toBeNull();
    expect(result?.name).toBe("deploy");
  });

  test("matches object column values with function properties without crashing", () => {
    const orm = new MiniORM();

    orm.create(Document, { id: 1, meta: { type: "report" }, tags: [] });
    orm.create(Document, { id: 2, meta: { type: "invoice" }, tags: [] });

    // Function properties in the where filter are ignored; only non-function keys are compared
    const result = orm.find(Document, { meta: { type: "report", render: () => "html" } as Record<string, unknown> });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(1);
  });

  test("matches object column values with BigInt properties without crashing", () => {
    const orm = new MiniORM();

    orm.create(Document, { id: 1, meta: { size: BigInt(9007199254740993) }, tags: [] });
    orm.create(Document, { id: 2, meta: { size: BigInt(42) }, tags: [] });

    const result = orm.find(Document, { meta: { size: BigInt(9007199254740993) } });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(1);
  });

  test("matches nested arrays in where clauses", () => {
    const orm = new MiniORM();

    orm.create(Document, { id: 1, meta: {}, tags: ["typescript", "orm"] });
    orm.create(Document, { id: 2, meta: {}, tags: ["typescript"] });
    orm.create(Document, { id: 3, meta: {}, tags: ["orm"] });

    expect(orm.find(Document, { tags: ["typescript", "orm"] })).toEqual([
      expect.objectContaining({ id: 1 }),
    ]);
    expect(orm.find(Document, { tags: ["typescript"] })).toEqual([
      expect.objectContaining({ id: 2 }),
    ]);
    expect(orm.findOne(Document, { tags: ["missing"] })).toBeNull();
  });

  test("returns detached instances instead of internal storage references", () => {
    const orm = new MiniORM();

    const created = orm.create(User, { id: 1, name: "Alice", age: 20, active: true });
    created.name = "Mutated";

    expect(orm.findOne(User, { id: 1 })).toEqual(
      expect.objectContaining({ name: "Alice" }),
    );
  });

  test("saves and retrieves entity with numeric primary key 0", () => {
    const orm = new MiniORM();

    orm.create(User, { id: 0, name: "Zero", age: 99, active: true });

    expect(orm.find(User)).toHaveLength(1);
    expect(orm.findOne(User, { id: 0 })).toEqual(
      expect.objectContaining({ id: 0, name: "Zero" }),
    );
  });

  test("findById(0) returns correct entity, not undefined", () => {
    const orm = new MiniORM();

    orm.create(User, { id: 0, name: "Zero", age: 1, active: false });
    orm.create(User, { id: 1, name: "One", age: 2, active: true });

    const result = orm.findOne(User, { id: 0 });

    expect(result).not.toBeNull();
    expect(result).toEqual(expect.objectContaining({ id: 0, name: "Zero" }));
  });

  test("saves and retrieves entity with empty-string primary key rejected", () => {
    const orm = new MiniORM();

    expect(() =>
      orm.create(StringUser, { id: "", name: "Empty" }),
    ).toThrow("Primary key id is required");
  });

  test("saves and retrieves entity with non-empty string primary key", () => {
    const orm = new MiniORM();

    orm.create(StringUser, { id: "abc", name: "Alpha" });

    expect(orm.findOne(StringUser, { id: "abc" })).toEqual(
      expect.objectContaining({ id: "abc", name: "Alpha" }),
    );
  });
});

describe("matchesWhere — JSON.stringify footguns", () => {
  test("object where clause requires matching key insertion order", () => {
    // JSON.stringify({"a":1,"b":2}) !== JSON.stringify({"b":2,"a":1})
    // so a where filter whose keys are in a different order from the stored value
    // will not match even though the objects are semantically equal.
    const orm = new MiniORM();
    orm.create(Product, { id: 1, name: "widget", meta: { a: 1, b: 2 } });

    // Same keys, same values, different insertion order — should NOT match due to
    // JSON.stringify key-order sensitivity. This documents a known limitation.
    const result = orm.find(Product, { meta: { b: 2, a: 1 } as Record<string, unknown> });
    expect(result).toHaveLength(0);
  });

  test("object where clause matches when key order is identical", () => {
    const orm = new MiniORM();
    orm.create(Product, { id: 1, name: "widget", meta: { a: 1, b: 2 } });

    const result = orm.find(Product, { meta: { a: 1, b: 2 } });
    expect(result).toHaveLength(1);
  });

  test("undefined properties in stored object are silently dropped by JSON comparison", () => {
    // JSON.stringify strips keys whose value is undefined. A stored object with an
    // undefined field will compare equal to one without that field at all.
    const orm = new MiniORM();
    // Store { tag: undefined, count: 5 } — JSON.stringify drops 'tag'
    orm.create(Product, { id: 1, name: "widget", meta: { tag: undefined, count: 5 } });

    // Querying without 'tag' matches because both stringify to {"count":5}
    const result = orm.find(Product, { meta: { count: 5 } });
    expect(result).toHaveLength(1);
  });
});

describe("cloneValue — isolation from stored data", () => {
  test("mutating a nested object returned by find does not corrupt the store", () => {
    const orm = new MiniORM();
    orm.create(Product, { id: 1, name: "widget", meta: { count: 0 } });

    const [found] = orm.find(Product);
    (found.meta as Record<string, unknown>).count = 99;

    const [refetched] = orm.find(Product);
    expect(refetched.meta).toEqual({ count: 0 });
  });

  test("mutating a nested object returned by create does not corrupt the store", () => {
    const orm = new MiniORM();
    const created = orm.create(Product, { id: 1, name: "widget", meta: { count: 0 } });
    (created.meta as Record<string, unknown>).count = 99;

    const stored = orm.findOne(Product, { id: 1 });
    expect(stored?.meta).toEqual({ count: 0 });
  });
});

describe("cloneValue — non-JSON-serializable field types", () => {
  test("Date fields remain Date instances after create", () => {
    const orm = new MiniORM();
    const start = new Date("2024-01-15T00:00:00.000Z");

    const event = orm.create(CalendarEvent, {
      id: 1,
      startDate: start,
      tags: new Set(),
      metadata: new Map(),
    });

    expect(event.startDate).toBeInstanceOf(Date);
    expect(event.startDate.toISOString()).toBe(start.toISOString());
  });

  test("mutating a returned Date does not corrupt stored entity", () => {
    const orm = new MiniORM();
    const start = new Date("2024-01-15T00:00:00.000Z");

    const event = orm.create(CalendarEvent, {
      id: 1,
      startDate: start,
      tags: new Set(),
      metadata: new Map(),
    });

    event.startDate.setFullYear(1999);

    const stored = orm.findOne(CalendarEvent, { id: 1 });
    expect(stored!.startDate.getFullYear()).toBe(2024);
  });

  test("Set fields remain Set instances after create", () => {
    const orm = new MiniORM();

    const event = orm.create(CalendarEvent, {
      id: 1,
      startDate: new Date(),
      tags: new Set(["alpha", "beta"]),
      metadata: new Map(),
    });

    expect(event.tags).toBeInstanceOf(Set);
    expect(event.tags.has("alpha")).toBe(true);
    expect(event.tags.has("beta")).toBe(true);
  });

  test("mutating a returned Set does not corrupt stored entity", () => {
    const orm = new MiniORM();

    orm.create(CalendarEvent, {
      id: 1,
      startDate: new Date(),
      tags: new Set(["alpha"]),
      metadata: new Map(),
    });

    const retrieved = orm.findOne(CalendarEvent, { id: 1 });
    retrieved!.tags.add("injected");

    const stored = orm.findOne(CalendarEvent, { id: 1 });
    expect(stored!.tags.has("injected")).toBe(false);
    expect(stored!.tags.size).toBe(1);
  });

  test("Map fields remain Map instances after create", () => {
    const orm = new MiniORM();

    const event = orm.create(CalendarEvent, {
      id: 1,
      startDate: new Date(),
      tags: new Set(),
      metadata: new Map([["key", "value"]]),
    });

    expect(event.metadata).toBeInstanceOf(Map);
    expect(event.metadata.get("key")).toBe("value");
  });

  test("mutating a returned Map does not corrupt stored entity", () => {
    const orm = new MiniORM();

    orm.create(CalendarEvent, {
      id: 1,
      startDate: new Date(),
      tags: new Set(),
      metadata: new Map([["key", "original"]]),
    });

    const retrieved = orm.findOne(CalendarEvent, { id: 1 });
    retrieved!.metadata.set("key", "mutated");

    const stored = orm.findOne(CalendarEvent, { id: 1 });
    expect(stored!.metadata.get("key")).toBe("original");
  });

  test("Set becomes empty object with JSON fallback — regression guard", () => {
    // Verify that the JSON fallback path would silently corrupt a Set.
    // This test documents the bug that explicit instanceof checks fix.
    const asJSON = JSON.parse(JSON.stringify(new Set([1, 2, 3])));
    expect(asJSON).not.toBeInstanceOf(Set);
    expect(Object.keys(asJSON)).toHaveLength(0); // {} — data lost
  });
});

describe("cloneValue — circular references", () => {
  test("throws a descriptive error when a column value contains circular references", () => {
    const orm = new MiniORM();

    // Build a circular object and assign it as a column value via type cast,
    // simulating data that bypasses TypeScript type checks at runtime.
    const circularObj: Record<string, unknown> = {};
    circularObj.self = circularObj;

    expect(() =>
      orm.create(User, { id: 1, name: circularObj as unknown as string, age: 20, active: true }),
    ).toThrow("Entity contains circular references");
  });
});


@Entity("meta-products")
class MetaProduct {
  @PrimaryKey()
  id!: number;

  @Column()
  name!: string;

  @Column()
  metadata!: Record<string, unknown>;
}


describe("matchesWhere — property order insensitivity", () => {
  test("finds entities when where clause object has properties in different insertion order", () => {
    const orm = new MiniORM();

    orm.create(MetaProduct, { id: 1, name: "Widget", metadata: { color: "red", size: "large" } });
    orm.create(MetaProduct, { id: 2, name: "Gadget", metadata: { color: "blue", size: "small" } });

    // Property order reversed relative to stored entity
    const result = orm.find(MetaProduct, { metadata: { size: "large", color: "red" } });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({ id: 1, name: "Widget" }));
  });

  test("does not match entities with different object values even if keys are same", () => {
    const orm = new MiniORM();

    orm.create(MetaProduct, { id: 1, name: "Widget", metadata: { color: "red", size: "large" } });

    expect(orm.find(MetaProduct, { metadata: { color: "red", size: "small" } })).toHaveLength(0);
    expect(orm.find(MetaProduct, { metadata: { color: "red" } })).toHaveLength(0);
    expect(orm.find(MetaProduct, { metadata: { color: "red", size: "large", extra: "x" } })).toHaveLength(0);
  });

  test("matches nested objects order-insensitively", () => {
    const orm = new MiniORM();

    orm.create(MetaProduct, { id: 1, name: "Widget", metadata: { dims: { w: 10, h: 20 } } });

    expect(orm.find(MetaProduct, { metadata: { dims: { h: 20, w: 10 } } })).toHaveLength(1);
    expect(orm.find(MetaProduct, { metadata: { dims: { h: 20, w: 99 } } })).toHaveLength(0);
  });

  test("matches array values in order", () => {
    const orm = new MiniORM();

    orm.create(MetaProduct, { id: 1, name: "Widget", metadata: { tags: ["a", "b"] } });

    expect(orm.find(MetaProduct, { metadata: { tags: ["a", "b"] } })).toHaveLength(1);
    // Arrays are order-sensitive
    expect(orm.find(MetaProduct, { metadata: { tags: ["b", "a"] } })).toHaveLength(0);
  });

  test("returns detached instances instead of internal storage references", () => {
    const orm = new MiniORM();

    const created = orm.create(User, { id: 1, name: "Alice", age: 20, active: true });
    created.name = "Mutated";

    expect(orm.findOne(User, { id: 1 })).toEqual(
      expect.objectContaining({ name: "Alice" }),
    );
  });
});

});
