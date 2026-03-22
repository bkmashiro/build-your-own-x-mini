# 17-mini-router

A minimal frontend router built from scratch in TypeScript.

## Features

| Feature | Details |
|---------|---------|
| **Hash mode** | `#/path` — works without a server |
| **History mode** | `pushState` / `popstate` |
| **Route parameters** | `/user/:id`, `/user/:id/posts/:postId` |
| **Nested routes** | Parent → child hierarchy with param inheritance |
| **Navigation guards** | `beforeEach` (sync & async), `afterEach` |
| **Query strings** | `?key=value` parsed into `match.query` |
| **Route meta** | Arbitrary metadata on route definitions |
| **onChange listener** | Subscribe to route changes |
| **Programmatic nav** | `push()`, `replace()`, `back()`, `forward()` |

## Installation

```bash
npm install
```

## Run tests

```bash
npm test
```

## Quick start

```ts
import { createRouter } from './src/index';

const router = createRouter({
  mode: 'history',          // or 'hash'
  routes: [
    { path: '/', name: 'home', component: 'Home' },
    { path: '/about', component: 'About' },
    {
      path: '/user/:id',
      component: 'User',
      children: [
        { path: '/profile', component: 'UserProfile' },
      ],
    },
  ],
  onNotFound: (path) => console.warn('No route for', path),
});

// Guard — e.g. authentication
router.beforeEach((to, from, next) => {
  if (to.route.meta?.requiresAuth && !isLoggedIn()) {
    next('/login');          // redirect
  } else {
    next();                  // allow
  }
});

// After-navigation hook
router.afterEach((to, from) => {
  document.title = to.route.name ?? 'App';
});

// Listen for changes
router.onChange((match) => {
  if (match) render(match.route.component, match.params);
});

// Start the router (attaches hashchange / popstate)
router.install();

// Programmatic navigation
await router.push('/user/42');
await router.replace('/about');
```

## API

### `createRouter(options)` / `new Router(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `'hash' \| 'history'` | `'hash'` | URL strategy |
| `routes` | `RouteConfig[]` | required | Route definitions |
| `onNotFound` | `(path: string) => void` | — | Unmatched-path callback |

### `RouteConfig`

```ts
interface RouteConfig {
  path: string;                         // e.g. '/user/:id'
  name?: string;
  component?: string | (() => void);
  children?: RouteConfig[];
  meta?: Record<string, unknown>;
}
```

### `RouteMatch`

```ts
interface RouteMatch {
  route: RouteConfig;               // matched config
  params: Record<string, string>;  // extracted path params
  query:  Record<string, string>;  // parsed query string
  fullPath: string;                 // compiled full pattern
  matched: RouteMatch[];            // ancestor chain (outermost → leaf)
}
```

### Instance methods

```ts
router.install()                     // attach browser listeners
router.destroy()                     // remove browser listeners
router.push(path)                    // navigate (adds history entry)
router.replace(path)                 // navigate (replaces history entry)
router.back() / router.forward()     // history traversal
router.resolve(path): RouteMatch|null// resolve without navigating
router.current: RouteMatch | null    // current route match

router.beforeEach(guard)  // returns unsubscribe fn
router.afterEach(hook)    // returns unsubscribe fn
router.onChange(listener) // returns unsubscribe fn
```

## How it works

```
push('/user/42/profile')
    │
    ▼
split pathname + query
    │
    ▼
matchRoutes() — depth-first tree walk
    │  compilePath('/user/:id') → regex + param keys
    │  compilePath('/user/:id/profile') → match!
    ▼
RouteMatch { params: {id:'42'}, matched: [parent, child] }
    │
    ▼
Run beforeEach guards sequentially (async-safe)
    │  next()      → continue
    │  next(false) → abort
    │  next('/x')  → redirect
    ▼
updateUrl (pushState / location.hash)
    │
    ▼
Commit → call onChange listeners → call afterEach hooks
```

## Project structure

```
17-mini-router/
├── src/
│   └── index.ts          ← router implementation
├── __tests__/
│   └── router.test.ts    ← Jest test suite (jsdom)
├── package.json
├── tsconfig.json
└── README.md
```
