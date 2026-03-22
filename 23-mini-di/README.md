# mini-di

> A tiny dependency injection container in TypeScript.  
> `@Injectable` metadata + constructor injection + singleton/transient scope.

[中文](README.zh.md)

---

## Background

Most DI containers do three small but important jobs:

1. Register a class or token
2. Figure out what constructor arguments it needs
3. Decide whether to reuse an instance or build a new one

This mini project keeps that core and drops the rest. No module system, no property injection, no runtime reflection library.

Instead, dependencies are declared explicitly in the decorator:

```ts
@Injectable({ deps: [Logger], scope: "singleton" })
class UserService {
  constructor(private readonly logger: Logger) {}
}
```

That keeps the implementation small while still showing the real control flow of a DI container.

---

## Architecture

```text
@Injectable(...)
    │
    ▼
WeakMap metadata registry
    │
    ▼
Container.resolve(Token)
    ├── get provider config
    ├── recursively resolve deps
    ├── new Class(...deps)
    └── cache if scope === "singleton"
```

### `@Injectable`

The decorator stores two pieces of metadata:

- `deps`: constructor dependency tokens
- `scope`: `"singleton"` or `"transient"`

### Resolution

`Container.resolve()` recursively builds the dependency graph. Decorated classes can be resolved directly without an explicit `register()` call.

### Scopes

- `singleton`: build once, reuse forever
- `transient`: build a new instance for every `resolve()`

### Circular dependency guard

The container tracks the current resolution stack. Resolving a token that is already in progress throws immediately instead of recursing forever.

---

## How to Run

```bash
cd 23-mini-di
bun run demo.ts
```

## Run Tests

```bash
cd 23-mini-di
bun test
```

---

## Key Takeaways

| Concept | How mini-di handles it |
|:--------|:-----------------------|
| Registration | Explicit via `register()` or implicit via decorator metadata |
| Constructor injection | `deps` array maps constructor parameters to tokens |
| Singleton scope | Cached in a `Map` after first construction |
| Transient scope | No cache, always `new` |
| Metadata store | `WeakMap` keyed by class constructor |
| Cycle detection | `Set` of currently resolving tokens |
