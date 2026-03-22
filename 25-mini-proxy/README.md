# 25-mini-proxy

A tiny Vue 3-style reactivity system in TypeScript.

## Features

- `reactive()` creates Proxy-based reactive objects
- `ref()` creates reactive boxed values
- `computed()` provides lazy cached derived values
- `effect()` auto-tracks dependencies and re-runs on change
- Nested objects are converted to reactive proxies on access

## Structure

```text
25-mini-proxy/
├── src/index.ts
├── __tests__/proxy.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

## API

```ts
import { computed, effect, reactive, ref } from "./src/index.ts";

const state = reactive({
  count: 1,
  nested: { label: "hi" },
});

const bonus = ref(2);

const total = computed(() => state.count + bonus.value);

effect(() => {
  console.log(total.value, state.nested.label);
});

state.count = 3;
state.nested.label = "updated";
bonus.value = 5;
```

## How it works

- Dependency graph: `WeakMap<object, Map<key, Set<effect>>>`
- `reactive()` uses a `Proxy` to call `track()` on `get` and `trigger()` on `set`
- `effect()` registers the currently running function as the active subscriber
- `computed()` wraps a lazy effect and invalidates its cache through a scheduler
- Nested objects are recursively wrapped with cached proxies to preserve identity

## Run tests

```bash
npm test
```
