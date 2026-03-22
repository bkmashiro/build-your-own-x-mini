/**
 * Tests for mini-router
 *
 * We use jest-environment-jsdom so that window, location, history are available.
 * Guards, nested routes, params, and both modes are all exercised.
 */

import { Router, createRouter, RouteConfig, RouteMatch } from '../src/index';

// ─────────────────────────────────────────────
// Shared route config used across many tests
// ─────────────────────────────────────────────

const routes: RouteConfig[] = [
  { path: '/', name: 'home', component: 'Home' },
  { path: '/about', name: 'about', component: 'About', meta: { requiresAuth: false } },
  {
    path: '/user/:id',
    name: 'user',
    component: 'User',
    children: [
      { path: '/profile', name: 'user-profile', component: 'UserProfile' },
      { path: '/posts/:postId', name: 'user-post', component: 'UserPost' },
    ],
  },
  {
    path: '/admin',
    name: 'admin',
    component: 'Admin',
    meta: { requiresAuth: true },
    children: [
      { path: '/dashboard', name: 'admin-dashboard', component: 'AdminDashboard' },
    ],
  },
  { path: '/search', name: 'search', component: 'Search' },
];

// ─────────────────────────────────────────────
// 1. Route resolution (no browser navigation)
// ─────────────────────────────────────────────

describe('Router.resolve()', () => {
  let router: Router;

  beforeEach(() => {
    router = createRouter({ mode: 'history', routes });
  });

  test('resolves root path "/"', () => {
    const match = router.resolve('/');
    expect(match).not.toBeNull();
    expect(match!.route.name).toBe('home');
    expect(match!.params).toEqual({});
  });

  test('resolves "/about"', () => {
    const match = router.resolve('/about');
    expect(match).not.toBeNull();
    expect(match!.route.name).toBe('about');
  });

  test('extracts route params from "/user/:id"', () => {
    const match = router.resolve('/user/42');
    expect(match).not.toBeNull();
    expect(match!.route.name).toBe('user');
    expect(match!.params).toEqual({ id: '42' });
  });

  test('returns null for unknown path', () => {
    const match = router.resolve('/not-found');
    expect(match).toBeNull();
  });

  test('parses query string into match.query', () => {
    const match = router.resolve('/search?q=hello&page=2');
    expect(match).not.toBeNull();
    expect(match!.query).toEqual({ q: 'hello', page: '2' });
  });
});

// ─────────────────────────────────────────────
// 2. Route params
// ─────────────────────────────────────────────

describe('Route parameters', () => {
  let router: Router;

  beforeEach(() => {
    router = createRouter({ mode: 'history', routes });
  });

  test('single param /user/:id', () => {
    const m = router.resolve('/user/7');
    expect(m!.params.id).toBe('7');
  });

  test('URL-decoded params', () => {
    const m = router.resolve('/user/hello%20world');
    expect(m!.params.id).toBe('hello world');
  });
});

// ─────────────────────────────────────────────
// 3. Nested routes
// ─────────────────────────────────────────────

describe('Nested routes', () => {
  let router: Router;

  beforeEach(() => {
    router = createRouter({ mode: 'history', routes });
  });

  test('matches child route /user/:id/profile', () => {
    const m = router.resolve('/user/5/profile');
    expect(m).not.toBeNull();
    expect(m!.route.name).toBe('user-profile');
    expect(m!.params.id).toBe('5');
  });

  test('matches deeply nested /user/:id/posts/:postId', () => {
    const m = router.resolve('/user/3/posts/99');
    expect(m).not.toBeNull();
    expect(m!.route.name).toBe('user-post');
    expect(m!.params).toMatchObject({ id: '3', postId: '99' });
  });

  test('match.matched chain contains parent then child', () => {
    const m = router.resolve('/user/1/profile');
    expect(m).not.toBeNull();
    // The matched array should end with the leaf route
    const names = m!.matched.map((r) => r.route.name);
    expect(names[names.length - 1]).toBe('user-profile');
  });

  test('matches /admin/dashboard child', () => {
    const m = router.resolve('/admin/dashboard');
    expect(m).not.toBeNull();
    expect(m!.route.name).toBe('admin-dashboard');
  });
});

// ─────────────────────────────────────────────
// 4. History mode navigation
// ─────────────────────────────────────────────

describe('History mode navigation', () => {
  let router: Router;

  beforeEach(() => {
    // Reset location to /
    window.history.replaceState(null, '', '/');
    router = createRouter({ mode: 'history', routes });
    router.install();
  });

  afterEach(() => {
    router.destroy();
  });

  test('install sets current match from window.location', () => {
    // install() was called above; initial path is '/'
    expect(router.current).not.toBeNull();
    expect(router.current!.route.name).toBe('home');
  });

  test('push() updates current match', async () => {
    await router.push('/about');
    expect(router.current!.route.name).toBe('about');
  });

  test('push() updates window.location.pathname', async () => {
    await router.push('/about');
    expect(window.location.pathname).toBe('/about');
  });

  test('replace() updates current match without new history entry', async () => {
    const before = window.history.length;
    await router.replace('/about');
    expect(router.current!.route.name).toBe('about');
    // replaceState should NOT grow history
    expect(window.history.length).toBe(before);
  });

  test('onChange listener fires on navigation', async () => {
    const listener = jest.fn();
    router.onChange(listener);
    await router.push('/about');
    expect(listener).toHaveBeenCalledTimes(1);
    const arg: RouteMatch = listener.mock.calls[0][0];
    expect(arg.route.name).toBe('about');
  });

  test('onChange unsubscribe stops notifications', async () => {
    const listener = jest.fn();
    const unsub = router.onChange(listener);
    unsub();
    await router.push('/about');
    expect(listener).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// 5. Hash mode navigation
// ─────────────────────────────────────────────

describe('Hash mode navigation', () => {
  let router: Router;

  beforeEach(() => {
    window.location.hash = '';
    router = createRouter({ mode: 'hash', routes });
    router.install();
  });

  afterEach(() => {
    router.destroy();
  });

  test('push() in hash mode changes current match', async () => {
    await router.push('/about');
    expect(router.current!.route.name).toBe('about');
  });

  test('resolve() works regardless of mode', () => {
    const m = router.resolve('/user/10');
    expect(m!.params.id).toBe('10');
  });
});

// ─────────────────────────────────────────────
// 6. Navigation guards (beforeEach)
// ─────────────────────────────────────────────

describe('Navigation guards — beforeEach', () => {
  let router: Router;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    router = createRouter({ mode: 'history', routes });
    router.install();
  });

  afterEach(() => {
    router.destroy();
  });

  test('guard that calls next() allows navigation', async () => {
    router.beforeEach((_to, _from, next) => next());
    await router.push('/about');
    expect(router.current!.route.name).toBe('about');
  });

  test('guard that calls next(false) blocks navigation', async () => {
    router.beforeEach((_to, _from, next) => next(false));
    await router.push('/about');
    // Should still be on home
    expect(router.current!.route.name).toBe('home');
  });

  test('guard that redirects via next(path) navigates to new path', async () => {
    router.beforeEach((to, _from, next) => {
      if (to.route.meta?.requiresAuth) {
        next('/');
      } else {
        next();
      }
    });
    await router.push('/admin');
    // /admin has requiresAuth=true → redirected to /
    expect(router.current!.route.name).toBe('home');
  });

  test('multiple guards run in order; first false wins', async () => {
    const order: number[] = [];
    router.beforeEach((_to, _from, next) => { order.push(1); next(); });
    router.beforeEach((_to, _from, next) => { order.push(2); next(false); });
    router.beforeEach((_to, _from, next) => { order.push(3); next(); });

    await router.push('/about');
    expect(order).toEqual([1, 2]); // guard 3 never runs
    expect(router.current!.route.name).toBe('home');
  });

  test('async guard is awaited before committing', async () => {
    router.beforeEach(async (_to, _from, next) => {
      await new Promise<void>((r) => setTimeout(r, 5));
      next();
    });
    await router.push('/about');
    expect(router.current!.route.name).toBe('about');
  });

  test('beforeEach unsubscribe removes guard', async () => {
    const unsub = router.beforeEach((_to, _from, next) => next(false));
    unsub();
    await router.push('/about');
    expect(router.current!.route.name).toBe('about');
  });

  test('afterEach hook fires after navigation', async () => {
    const hook = jest.fn();
    router.afterEach(hook);
    await router.push('/about');
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook.mock.calls[0][0].route.name).toBe('about');
  });

  test('afterEach hook does NOT fire when guard blocks', async () => {
    const hook = jest.fn();
    router.afterEach(hook);
    router.beforeEach((_to, _from, next) => next(false));
    await router.push('/about');
    expect(hook).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// 7. onNotFound callback
// ─────────────────────────────────────────────

describe('onNotFound', () => {
  test('is called for unmatched paths', async () => {
    const onNotFound = jest.fn();
    window.history.replaceState(null, '', '/');
    const router = createRouter({ mode: 'history', routes, onNotFound });
    router.install();
    await router.push('/missing');
    expect(onNotFound).toHaveBeenCalledWith('/missing');
    router.destroy();
  });
});

// ─────────────────────────────────────────────
// 8. meta field
// ─────────────────────────────────────────────

describe('Route meta', () => {
  let router: Router;

  beforeEach(() => {
    router = createRouter({ mode: 'history', routes });
  });

  test('meta is accessible on matched route', () => {
    const m = router.resolve('/about');
    expect(m!.route.meta?.requiresAuth).toBe(false);
  });

  test('meta on admin route', () => {
    const m = router.resolve('/admin');
    expect(m!.route.meta?.requiresAuth).toBe(true);
  });
});
