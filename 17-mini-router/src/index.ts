/**
 * mini-router: A minimal frontend router in TypeScript
 *
 * Features:
 * - Hash mode (#/path) and History mode (pushState)
 * - Route parameters (/user/:id)
 * - Nested routes (parent/child)
 * - Navigation guards (beforeEach, afterEach)
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type RouterMode = 'hash' | 'history';

export interface RouteConfig {
  path: string;
  name?: string;
  component?: string | (() => void);
  children?: RouteConfig[];
  meta?: Record<string, unknown>;
}

export interface RouteMatch {
  /** Matched RouteConfig */
  route: RouteConfig;
  /** Extracted path params, e.g. { id: '42' } */
  params: Record<string, string>;
  /** Full matched path including parent segments */
  fullPath: string;
  /** Query string params */
  query: Record<string, string>;
  /** Matched ancestor chain (outermost first, leaf last) */
  matched: RouteMatch[];
}

export type NavigationGuard = (
  to: RouteMatch,
  from: RouteMatch | null,
  next: (redirect?: string | false) => void,
) => void | Promise<void>;

export type AfterNavigationHook = (to: RouteMatch, from: RouteMatch | null) => void;

export interface RouterOptions {
  mode?: RouterMode;
  routes: RouteConfig[];
  /** Called when no route matches */
  onNotFound?: (path: string) => void;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Convert a route path pattern like "/user/:id/post/:postId"
 * into a RegExp and a list of param names.
 */
function compilePath(pattern: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = [];
  // Escape dots, replace :param with a named capture group
  const src = pattern
    .replace(/\./g, '\\.')
    .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, key: string) => {
      keys.push(key);
      return '([^/]+)';
    });
  // Allow optional trailing slash; full-match anchors
  const regex = new RegExp(`^${src}\\/?$`);
  return { regex, keys };
}

/**
 * Parse a query string (without leading '?') into a plain object.
 */
function parseQuery(search: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!search) return result;
  const qs = search.startsWith('?') ? search.slice(1) : search;
  qs.split('&').forEach((pair) => {
    if (!pair) return;
    const [k, v = ''] = pair.split('=');
    result[decodeURIComponent(k)] = decodeURIComponent(v);
  });
  return result;
}

// ─────────────────────────────────────────────
// Route matching (supports nesting)
// ─────────────────────────────────────────────

/**
 * Try to match `pathname` against a flat list of route configs
 * (which may themselves have children).  Returns null if no match.
 *
 * The algorithm walks the tree depth-first so that more-specific
 * (deeper) routes win over parent catch-alls.
 */
function matchRoutes(
  routes: RouteConfig[],
  pathname: string,
  parentPath = '',
  ancestors: RouteMatch[] = [],
  query: Record<string, string> = {},
): RouteMatch | null {
  for (const route of routes) {
    const fullPattern = parentPath + route.path;
    const { regex, keys } = compilePath(fullPattern);

    // Try children first (depth-first, more specific wins)
    if (route.children && route.children.length > 0) {
      // Build a partial match for the parent segment to pass down
      const parentRegex = compilePath(fullPattern).regex;
      const parentMatch = pathname.match(parentRegex);
      // Parent segment match needed to descend
      const parentSegmentRegex = new RegExp(`^${fullPattern.replace(/\./g, '\\.').replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '([^/]+)')}(/.*)?$`);
      const canDescend = parentSegmentRegex.test(pathname) || pathname.startsWith(fullPattern.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '')) || parentMatch;

      if (canDescend) {
        // Build current ancestor match (params may be partial)
        const currentMatch = parentMatch
          ? buildMatch(route, keys, parentMatch, fullPattern, query, ancestors)
          : null;
        const nextAncestors = currentMatch ? [...ancestors, currentMatch] : ancestors;
        const childMatch = matchRoutes(route.children, pathname, fullPattern, nextAncestors, query);
        if (childMatch) return childMatch;
      }
    }

    // Try exact match at this level
    const m = pathname.match(regex);
    if (m) {
      return buildMatch(route, keys, m, fullPattern, query, ancestors);
    }
  }
  return null;
}

function buildMatch(
  route: RouteConfig,
  keys: string[],
  m: RegExpMatchArray,
  fullPath: string,
  query: Record<string, string>,
  ancestors: RouteMatch[],
): RouteMatch {
  const params: Record<string, string> = {};
  keys.forEach((key, i) => {
    params[key] = decodeURIComponent(m[i + 1] ?? '');
  });
  const self: RouteMatch = {
    route,
    params,
    fullPath,
    query,
    matched: [], // filled below
  };
  self.matched = [...ancestors, self];
  return self;
}

// ─────────────────────────────────────────────
// Router class
// ─────────────────────────────────────────────

export class Router {
  private mode: RouterMode;
  private routes: RouteConfig[];
  private onNotFound?: (path: string) => void;

  private currentMatch: RouteMatch | null = null;
  private beforeHooks: NavigationGuard[] = [];
  private afterHooks: AfterNavigationHook[] = [];

  /** Listeners that are notified after every successful navigation */
  private changeListeners: Array<(match: RouteMatch | null) => void> = [];

  constructor(options: RouterOptions) {
    this.mode = options.mode ?? 'hash';
    this.routes = options.routes;
    this.onNotFound = options.onNotFound;
  }

  // ── Lifecycle ──────────────────────────────

  /** Install popstate / hashchange listeners. Call once on app init. */
  install(): void {
    if (this.mode === 'hash') {
      window.addEventListener('hashchange', this._onHashChange);
      // Navigate to the current hash on install
      this._navigate(this._currentHashPath(), false);
    } else {
      window.addEventListener('popstate', this._onPopState);
      this._navigate(window.location.pathname + window.location.search, false);
    }
  }

  /** Remove event listeners. Call on app teardown. */
  destroy(): void {
    if (this.mode === 'hash') {
      window.removeEventListener('hashchange', this._onHashChange);
    } else {
      window.removeEventListener('popstate', this._onPopState);
    }
  }

  // ── Guards & hooks ─────────────────────────

  /** Register a global before-navigation guard. */
  beforeEach(guard: NavigationGuard): () => void {
    this.beforeHooks.push(guard);
    return () => {
      this.beforeHooks = this.beforeHooks.filter((g) => g !== guard);
    };
  }

  /** Register a global after-navigation hook. */
  afterEach(hook: AfterNavigationHook): () => void {
    this.afterHooks.push(hook);
    return () => {
      this.afterHooks = this.afterHooks.filter((h) => h !== hook);
    };
  }

  /** Subscribe to route changes (receives the new RouteMatch or null). */
  onChange(listener: (match: RouteMatch | null) => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter((l) => l !== listener);
    };
  }

  // ── Navigation ─────────────────────────────

  /** Programmatic navigation (push). */
  async push(path: string): Promise<void> {
    await this._navigate(path, true);
  }

  /** Programmatic navigation (replace — no new history entry). */
  async replace(path: string): Promise<void> {
    await this._navigate(path, false, true);
  }

  /** Go back in history. */
  back(): void {
    window.history.back();
  }

  /** Go forward in history. */
  forward(): void {
    window.history.forward();
  }

  // ── State accessors ────────────────────────

  get current(): RouteMatch | null {
    return this.currentMatch;
  }

  /** Resolve a path without navigating — useful for link generation. */
  resolve(path: string): RouteMatch | null {
    const [pathname, search = ''] = path.split('?');
    const query = parseQuery(search);
    return matchRoutes(this.routes, pathname, '', [], query);
  }

  // ── Internal ───────────────────────────────

  private _currentHashPath(): string {
    const hash = window.location.hash;
    return hash ? hash.slice(1) || '/' : '/';
  }

  private _onHashChange = (): void => {
    void this._navigate(this._currentHashPath(), false);
  };

  private _onPopState = (): void => {
    void this._navigate(window.location.pathname + window.location.search, false);
  };

  private async _navigate(
    rawPath: string,
    push: boolean,
    replace = false,
  ): Promise<void> {
    const [pathname, search = ''] = rawPath.split('?');
    const query = parseQuery(search);
    const to = matchRoutes(this.routes, pathname, '', [], query);

    if (!to) {
      this.onNotFound?.(rawPath);
      return;
    }

    const from = this.currentMatch;

    // Run before-guards sequentially
    const allowed = await this._runGuards(to, from);
    if (!allowed) return; // navigation aborted
    if (typeof allowed === 'string') {
      // Redirected to another path
      await this._navigate(allowed, push, replace);
      return;
    }

    // Update browser URL
    this._updateUrl(rawPath, push, replace);

    // Commit
    this.currentMatch = to;
    this.changeListeners.forEach((l) => l(to));
    this.afterHooks.forEach((h) => h(to, from));
  }

  /** Returns true to proceed, false to abort, or a string to redirect. */
  private async _runGuards(
    to: RouteMatch,
    from: RouteMatch | null,
  ): Promise<boolean | string> {
    for (const guard of this.beforeHooks) {
      const result = await new Promise<boolean | string>((resolve) => {
        const next = (redirect?: string | false) => {
          if (redirect === false) resolve(false);
          else if (typeof redirect === 'string') resolve(redirect);
          else resolve(true);
        };
        const ret = guard(to, from, next);
        // If the guard returned a Promise, let it settle; next() was called above
        if (ret instanceof Promise) {
          ret.catch(() => resolve(false));
        }
      });
      if (result !== true) return result;
    }
    return true;
  }

  private _updateUrl(path: string, push: boolean, replace: boolean): void {
    if (this.mode === 'hash') {
      const newHash = `#${path}`;
      if (replace) {
        window.location.replace(newHash);
      } else if (push) {
        window.location.hash = path;
      }
      // if push===false && replace===false (initial install), do nothing
    } else {
      if (replace || !push) {
        window.history.replaceState(null, '', path);
      } else {
        window.history.pushState(null, '', path);
      }
    }
  }
}

// ─────────────────────────────────────────────
// Factory helper
// ─────────────────────────────────────────────

/** Convenience factory — mirrors Vue Router's createRouter() API shape. */
export function createRouter(options: RouterOptions): Router {
  return new Router(options);
}
