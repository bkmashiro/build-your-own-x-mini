type Constructor<T> = abstract new (...args: any[]) => T;
type Primitive = string | number | boolean | bigint | symbol | null | undefined;

export type EntityRecord = Record<string, unknown>;
export type Where<T extends EntityRecord> = Partial<{
  [K in keyof T]:
    | T[K]
    | ((value: T[K], entity: T) => boolean);
}>;

type ColumnDefinition = {
  propertyKey: string;
  primary: boolean;
};

type EntityMetadata = {
  name: string;
  columns: Map<string, ColumnDefinition>;
  primaryKey?: string;
};

type EntityTarget<T extends EntityRecord> = Constructor<T>;
type CreateInput<T extends EntityRecord> = Partial<T>;
type UpdateInput<T extends EntityRecord> = Partial<T>;

const entityMetadata = new WeakMap<Function, EntityMetadata>();

/**
 * Returns the EntityMetadata for a constructor, creating a default entry if none exists.
 * Needed because decorators may run before the metadata map is populated.
 */
function ensureMetadata(target: Function): EntityMetadata {
  let metadata = entityMetadata.get(target);
  if (!metadata) {
    metadata = {
      name: target.name,
      columns: new Map(),
    };
    entityMetadata.set(target, metadata);
  }
  return metadata;
}

/**
 * Deep-clones a value using `structuredClone` when available, falling back to a
 * JSON round-trip for older environments. Non-serialisable values (functions, symbols) are lost in the fallback.
 */
function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  // Fallback for environments without structuredClone (Node <17, older browsers).
  // JSON.parse/stringify will throw on non-serializable values (functions, symbols,
  // BigInt, circular references) and silently drops undefined properties.
  // Prefer keeping structuredClone available to avoid these edge cases.
  if (value === undefined) {
    throw new Error("Cannot clone undefined: JSON fallback would silently drop this value");
  }
  if (typeof value === "number" && isNaN(value)) {
    throw new Error("Cannot clone NaN: JSON fallback would corrupt this value to null");
  }
  if (typeof value === "symbol") {
    throw new Error("Cannot clone Symbol: JSON fallback would silently drop this value");
  }
  if (value instanceof Date) {
    return new Date(value) as T;
  }
  if (value instanceof Map) {
    return new Map(value) as T;
  }
  if (value instanceof Set) {
    return new Set(value) as T;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepEqual(a: unknown, b: unknown, seen = new Set<unknown>()): boolean {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, value] of a) {
      if (!b.has(key) || !deepEqual(value, b.get(key), seen)) return false;
    }
    return true;
  }
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const value of a) {
      if (!b.has(value)) return false;
    }
    return true;
  }
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (a === null || b === null) return false;
  if (seen.has(a)) return true;
  seen.add(a);
  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) =>
    deepEqual(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
      seen,
    ),
  );
}

/**
 * Returns true if `entity` satisfies every constraint in `where`.
 * A missing `where` always matches; function values are called as predicates;
 * objects and arrays are compared by structural deep equality; primitives use strict equality.
 */
function matchesWhere<T extends EntityRecord>(entity: T, where?: Where<T>): boolean {
  if (!where) {
    return true;
  }

  for (const [key, expected] of Object.entries(where) as [
    keyof T,
    Where<T>[keyof T],
  ][]) {
    const actual = entity[key];
    if (typeof expected === "function") {
      if (!expected(actual, entity)) {
        return false;
      }
      continue;
    }

    if (isPlainObject(expected) || Array.isArray(expected)) {
      if (!deepEqual(actual, expected)) {
        return false;
      }
      continue;
    }

    if (actual !== expected) {
      return false;
    }
  }

  return true;
}

function validateEntity<T extends EntityRecord>(target: EntityTarget<T>): EntityMetadata {
  const metadata = entityMetadata.get(target);
  if (!metadata) {
    throw new Error(`Entity metadata not found for ${target.name}`);
  }
  if (!metadata.primaryKey) {
    throw new Error(`Primary key not defined for ${target.name}`);
  }
  return metadata;
}

/**
 * Class decorator that registers a class as a managed entity.
 *
 * Must be applied before `@PrimaryKey` / `@Column` decorators are used.
 * The optional `name` overrides the table/entity name used in error messages
 * (defaults to the class name).
 *
 * @param name - Optional logical entity name (defaults to the class constructor name).
 * @returns A class decorator that attaches entity metadata.
 *
 * @example
 * \@Entity("users")
 * class User {
 *   \@PrimaryKey() id!: number;
 *   \@Column()     name!: string;
 * }
 */
export function Entity(name?: string) {
  return function <T extends Function>(target: T): void {
    const metadata = ensureMetadata(target);
    metadata.name = name ?? target.name;
  };
}

/**
 * Property decorator that marks a class field as a mapped column.
 *
 * The property must also belong to a class decorated with `@Entity`.
 * A column is **not** the primary key; use `@PrimaryKey` for that.
 *
 * @returns A property decorator that registers the field in the entity's column map.
 *
 * @example
 * \@Entity()
 * class Product {
 *   \@PrimaryKey() id!: string;
 *   \@Column()     name!: string;
 *   \@Column()     price!: number;
 * }
 */
export function Column() {
  return function (target: object, propertyKey: string): void {
    const metadata = ensureMetadata((target as { constructor: Function }).constructor);
    const current = metadata.columns.get(propertyKey);
    metadata.columns.set(propertyKey, {
      propertyKey,
      primary: current?.primary ?? false,
    });
  };
}

/**
 * Property decorator that designates a field as the entity's primary key.
 *
 * Each entity class must have exactly one `@PrimaryKey` field. The value
 * is used as the storage key and must be non-null/non-empty at create time.
 * Changing a primary key via `update` is supported as long as the new value
 * does not collide with an existing row.
 *
 * @returns A property decorator that registers the field as the primary key column.
 *
 * @example
 * \@Entity()
 * class User {
 *   \@PrimaryKey() id!: number;
 *   \@Column()     email!: string;
 * }
 */
export function PrimaryKey() {
  return function (target: object, propertyKey: string): void {
    const metadata = ensureMetadata((target as { constructor: Function }).constructor);
    metadata.primaryKey = propertyKey;
    metadata.columns.set(propertyKey, {
      propertyKey,
      primary: true,
    });
  };
}

class Repository<T extends EntityRecord> {
  constructor(
    private readonly target: EntityTarget<T>,
    private readonly metadata: EntityMetadata,
    private readonly rows: Map<unknown, T>,
  ) {}

  find(where?: Where<T>): T[] {
    return [...this.rows.values()]
      .filter((entity) => matchesWhere(entity, where))
      .map((entity) => this.hydrate(entity));
  }

  findOne(where: Where<T>): T | null {
    for (const entity of this.rows.values()) {
      if (matchesWhere(entity, where)) {
        return this.hydrate(entity);
      }
    }
    return null;
  }

  create(input: CreateInput<T>): T {
    const instance = new (this.target as new () => T)();
    for (const column of this.metadata.columns.keys()) {
      if (column in input) {
        instance[column as keyof T] = cloneValue(input[column as keyof T]) as T[keyof T];
      }
    }

    const primaryKey = this.metadata.primaryKey as keyof T;
    const id = instance[primaryKey];
    if (id === undefined || id === null || id === "") {
      throw new Error(`Primary key ${String(primaryKey)} is required`);
    }
    if (this.rows.has(id)) {
      throw new Error(
        `${this.metadata.name} with primary key ${String(id)} already exists`,
      );
    }

    this.rows.set(id, cloneValue(instance));
    return this.hydrate(instance);
  }

  update(where: Where<T>, input: UpdateInput<T>): T[] {
    const updated: T[] = [];
    const primaryKey = this.metadata.primaryKey as keyof T;

    for (const [rowId, entity] of this.rows.entries()) {
      if (!matchesWhere(entity, where)) {
        continue;
      }

      const nextEntity = cloneValue(entity);
      for (const column of this.metadata.columns.keys()) {
        if (column in input) {
          nextEntity[column as keyof T] = cloneValue(
            input[column as keyof T],
          ) as T[keyof T];
        }
      }

      const nextId = nextEntity[primaryKey];
      if (nextId === undefined || nextId === null || (typeof nextId !== "object" && nextId === "")) {
        throw new Error(`Primary key ${String(primaryKey)} cannot be empty`);
      }
      if (nextId !== rowId && this.rows.has(nextId)) {
        throw new Error(
          `${this.metadata.name} with primary key ${String(nextId)} already exists`,
        );
      }

      this.rows.delete(rowId);
      this.rows.set(nextId, nextEntity);
      updated.push(this.hydrate(nextEntity));
    }

    return updated;
  }

  delete(where: Where<T>): number {
    let count = 0;
    for (const [rowId, entity] of this.rows.entries()) {
      if (!matchesWhere(entity, where)) {
        continue;
      }
      this.rows.delete(rowId);
      count += 1;
    }
    return count;
  }

  /** Reconstructs a typed class instance from a plain stored record, cloning each column value. */
  private hydrate(entity: T): T {
    const instance = new (this.target as new () => T)();
    for (const column of this.metadata.columns.keys()) {
      instance[column as keyof T] = cloneValue(entity[column as keyof T]) as T[keyof T];
    }
    return instance;
  }
}

/**
 * In-memory ORM for entities decorated with `@Entity`, `@PrimaryKey`, and `@Column`.
 *
 * Each `MiniORM` instance maintains its own isolated table store. Entities are
 * hydrated into class instances on every read so mutations to returned objects
 * do not affect stored state.
 *
 * @example
 * const orm = new MiniORM();
 *
 * \@Entity()
 * class User {
 *   \@PrimaryKey() id!: number;
 *   \@Column()     name!: string;
 * }
 *
 * orm.create(User, { id: 1, name: "Alice" });
 * orm.find(User); // → [User { id: 1, name: "Alice" }]
 */
export class MiniORM {
  private readonly tables = new Map<Function, Map<unknown, EntityRecord>>();

  /**
   * Returns a `Repository` for the given entity class, creating an empty table if needed.
   *
   * @param target - The entity class (must be decorated with `@Entity` and `@PrimaryKey`).
   * @returns A `Repository<T>` scoped to this ORM instance.
   * @throws {Error} When `target` has no entity metadata or is missing a primary key.
   *
   * @example
   * const repo = orm.getRepository(User);
   * repo.create({ id: 1, name: "Alice" });
   */
  getRepository<T extends EntityRecord>(target: EntityTarget<T>): Repository<T> {
    const metadata = validateEntity(target);
    let rows = this.tables.get(target);
    if (!rows) {
      rows = new Map();
      this.tables.set(target, rows);
    }
    return new Repository(target, metadata, rows as Map<unknown, T>);
  }

  /**
   * Returns all entities of the given type that satisfy the optional filter.
   *
   * Each value in `where` can be a literal (strict equality) or a predicate function.
   * Omitting `where` returns every stored entity.
   *
   * @param target - The entity class to query.
   * @param where - Optional filter: property → literal value or `(value, entity) => boolean`.
   * @returns A new array of hydrated entity instances (mutations do not affect the store).
   *
   * @example
   * orm.find(User, { name: "Alice" });
   * orm.find(User, { age: (age) => age >= 18 });
   */
  find<T extends EntityRecord>(target: EntityTarget<T>, where?: Where<T>): T[] {
    return this.getRepository(target).find(where);
  }

  /**
   * Returns the first entity that satisfies the filter, or `null` if none matches.
   *
   * @param target - The entity class to query.
   * @param where - Filter: property → literal value or predicate function.
   * @returns A hydrated entity instance or `null`.
   *
   * @example
   * const user = orm.findOne(User, { id: 1 });
   * if (user) console.log(user.name);
   */
  findOne<T extends EntityRecord>(target: EntityTarget<T>, where: Where<T>): T | null {
    return this.getRepository(target).findOne(where);
  }

  /**
   * Creates and stores a new entity from the given input.
   *
   * Only fields declared with `@Column` or `@PrimaryKey` are persisted.
   * The primary key must be present and non-empty, and must not duplicate an existing row.
   *
   * @param target - The entity class to instantiate.
   * @param input - Partial field values; must include the primary key.
   * @returns A hydrated instance of the newly created entity.
   * @throws {Error} When the primary key is missing, empty, or already exists.
   *
   * @example
   * const user = orm.create(User, { id: 1, name: "Alice" });
   * // → User { id: 1, name: "Alice" }
   */
  create<T extends EntityRecord>(target: EntityTarget<T>, input: CreateInput<T>): T {
    return this.getRepository(target).create(input);
  }

  /**
   * Updates all entities matching `where` with the fields in `input`.
   *
   * Only `@Column` / `@PrimaryKey` fields are updated. If the primary key
   * is changed, the row is re-keyed; the new key must not collide with another row.
   *
   * @param target - The entity class to update.
   * @param where - Filter identifying rows to update.
   * @param input - Partial fields to overwrite.
   * @returns Array of hydrated updated instances.
   * @throws {Error} When the resulting primary key is null/undefined or collides with an existing row.
   *
   * @example
   * orm.update(User, { id: 1 }, { name: "Bob" });
   * // → [User { id: 1, name: "Bob" }]
   */
  update<T extends EntityRecord>(
    target: EntityTarget<T>,
    where: Where<T>,
    input: UpdateInput<T>,
  ): T[] {
    return this.getRepository(target).update(where, input);
  }

  /**
   * Deletes all entities matching `where` and returns the count removed.
   *
   * @param target - The entity class to delete from.
   * @param where - Filter identifying rows to delete.
   * @returns The number of rows deleted (0 if no rows matched).
   *
   * @example
   * orm.create(User, { id: 1, name: "Alice" });
   * orm.delete(User, { id: 1 }); // → 1
   * orm.find(User);              // → []
   */
  delete<T extends EntityRecord>(target: EntityTarget<T>, where: Where<T>): number {
    return this.getRepository(target).delete(where);
  }
}
