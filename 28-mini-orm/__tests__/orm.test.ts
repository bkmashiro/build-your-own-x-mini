import { describe, expect, test } from "bun:test";

import { Column, Entity, MiniORM, PrimaryKey } from "../src/index";

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
  id!: number;

  @Column()
  name!: string;

  @Column()
  description: string | undefined;
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

  test("preserves undefined field values instead of converting to null", () => {
    const orm = new MiniORM();

    const created = orm.create(Product, { id: 1, name: "Widget", description: undefined });

    expect(created.description).toBeUndefined();
    expect("description" in created).toBe(true);

    const found = orm.findOne(Product, { id: 1 });
    expect(found).not.toBeNull();
    expect(found!.description).toBeUndefined();
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
