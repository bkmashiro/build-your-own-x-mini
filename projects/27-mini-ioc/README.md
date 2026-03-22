# mini-ioc

> A tiny TypeScript inversion-of-control container with typed tokens, factories, and lifecycle scopes.

[中文](README.zh.md)

---

## Background

Most IoC containers solve the same three problems:

1. **Mapping abstractions to implementations**
2. **Building object graphs automatically**
3. **Controlling object lifetime**

TypeScript adds one wrinkle: interfaces disappear at runtime. That means "bind interface to implementation" is really "bind a runtime token that is typed as an interface". This project keeps that explicit instead of hiding it behind decorators or reflection.

---

## Architecture

```text
Token<T> (symbol)
    │
    ▼
Binding
    ├── value     -> constant config / singleton object
    ├── class     -> constructor + dependency tokens
    └── factory   -> custom resolver callback
    │
    ▼
Container
    ├── singleton cache  -> shared by root + child scopes
    ├── scoped cache     -> one cache per scope
    └── transient path   -> new instance every resolve
```

### Interface Binding

```ts
interface Logger {
  log(message: string): void;
}

const LOGGER = createToken<Logger>("Logger");
container.bind(LOGGER).toClass(ConsoleLogger, [], "singleton");
```

The interface is compile-time only. The `symbol` token is the runtime identity.

### Factory Support

Factories receive the resolver so they can compose other bindings:

```ts
container.bind(REQUEST_ID).toFactory(() => crypto.randomUUID(), "scoped");
container.bind(SERVICE).toFactory((resolver) => {
  return new Service(resolver.resolve(LOGGER), resolver.resolve(REQUEST_ID));
});
```

### Lifetime Management

- `singleton`: one instance for the whole container tree
- `scoped`: one instance per scope
- `transient`: new instance every resolution

If a resolved object implements `dispose()` or `Symbol.dispose`, the container tracks it and disposes it when the owning scope is disposed.

---

## How to Run

```bash
cd projects/27-mini-ioc
npm test
npm run demo
```

---

## What This Omits

- No decorators or reflect-metadata
- No async factories
- No circular dependency detection

That keeps the core mechanics visible: bindings, caches, scope boundaries, and disposal.
