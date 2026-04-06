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

  test("returns detached instances instead of internal storage references", () => {
    const orm = new MiniORM();

    const created = orm.create(User, { id: 1, name: "Alice", age: 20, active: true });
    created.name = "Mutated";

    expect(orm.findOne(User, { id: 1 })).toEqual(
      expect.objectContaining({ name: "Alice" }),
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
