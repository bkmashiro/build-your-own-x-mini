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

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  // Fallback for environments without structuredClone (Node <17, older browsers).
  // JSON.parse/stringify will throw on non-serializable values (functions, symbols,
  // BigInt, circular references) and silently drops undefined properties.
  // Prefer keeping structuredClone available to avoid these edge cases.
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
      // Deep equality via JSON.stringify: key insertion order must match for objects,
      // and non-serializable properties (functions, undefined, symbols) are dropped or
      // throw, which can produce false positives or runtime errors. If precise deep
      // equality is needed, replace this with a dedicated structural-equality utility.
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
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

export function Entity(name?: string) {
  return function <T extends Function>(target: T): void {
    const metadata = ensureMetadata(target);
    metadata.name = name ?? target.name;
  };
}

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
    if (id === undefined || id === null || (typeof id !== "object" && id === "")) {
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
      if (nextId === undefined || nextId === null) {
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

  private hydrate(entity: T): T {
    const instance = new (this.target as new () => T)();
    for (const column of this.metadata.columns.keys()) {
      instance[column as keyof T] = cloneValue(entity[column as keyof T]) as T[keyof T];
    }
    return instance;
  }
}

export class MiniORM {
  private readonly tables = new Map<Function, Map<unknown, EntityRecord>>();

  getRepository<T extends EntityRecord>(target: EntityTarget<T>): Repository<T> {
    const metadata = validateEntity(target);
    let rows = this.tables.get(target);
    if (!rows) {
      rows = new Map();
      this.tables.set(target, rows);
    }
    return new Repository(target, metadata, rows as Map<unknown, T>);
  }

  find<T extends EntityRecord>(target: EntityTarget<T>, where?: Where<T>): T[] {
    return this.getRepository(target).find(where);
  }

  findOne<T extends EntityRecord>(target: EntityTarget<T>, where: Where<T>): T | null {
    return this.getRepository(target).findOne(where);
  }

  create<T extends EntityRecord>(target: EntityTarget<T>, input: CreateInput<T>): T {
    return this.getRepository(target).create(input);
  }

  update<T extends EntityRecord>(
    target: EntityTarget<T>,
    where: Where<T>,
    input: UpdateInput<T>,
  ): T[] {
    return this.getRepository(target).update(where, input);
  }

  delete<T extends EntityRecord>(target: EntityTarget<T>, where: Where<T>): number {
    return this.getRepository(target).delete(where);
  }
}
