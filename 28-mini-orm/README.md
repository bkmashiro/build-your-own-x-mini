# 28-mini-orm

A tiny decorator-based ORM written in TypeScript with in-memory storage.

## Features

- `@Entity`, `@Column`, `@PrimaryKey` decorators
- CRUD APIs: `find`, `findOne`, `create`, `update`, `delete`
- Simple `where` conditions with exact-value matching or predicates
- In-memory persistence for learning and testing

## Structure

```text
28-mini-orm/
├── src/index.ts
├── __tests__/orm.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Usage

```ts
import { Column, Entity, MiniORM, PrimaryKey } from "./src/index";

@Entity("users")
class User {
  @PrimaryKey()
  id!: number;

  @Column()
  name!: string;

  @Column()
  age!: number;
}

const orm = new MiniORM();

orm.create(User, { id: 1, name: "Alice", age: 20 });
orm.create(User, { id: 2, name: "Bob", age: 28 });

const adults = orm.find(User, {
  age: (value) => value >= 21,
});
```

## Test

```bash
bun test
```
