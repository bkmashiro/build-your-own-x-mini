/**
 * MiniReact - A simplified React implementation
 *
 * Features:
 * - createElement / render
 * - Function components
 * - useState / useEffect hooks
 * - Diff algorithm for DOM updates
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type Props = Record<string, unknown> & { children?: VNode[] };

export interface VNode {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type: string | FunctionComponent<any>;
  props: Props;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FunctionComponent<P = any> = (props: P & { children?: VNode[] }) => VNode | null;

// ─── Hook State ──────────────────────────────────────────────────────────────

interface HookState {
  states: unknown[];
  effects: EffectRecord[];
  stateIndex: number;
  effectIndex: number;
}

interface EffectRecord {
  deps: unknown[] | undefined;
  cleanup: (() => void) | void;
  callback: () => (() => void) | void;
}

let currentComponent: HookState | null = null;
const componentHooks = new Map<object, HookState>();

// ─── Rendering State ─────────────────────────────────────────────────────────

/** Root container → { original (unresolved) vnode, last resolved vnode } */
const renderRoots = new Map<Element, { source: VNode; resolved: VNode } | null>();

// ─── createElement ────────────────────────────────────────────────────────────

export function createElement(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type: string | FunctionComponent<any>,
  props: Record<string, unknown> | null,
  ...rawChildren: (VNode | string | number | boolean | null | undefined)[]
): VNode {
  const children: VNode[] = rawChildren
    .flat()
    .filter((c) => c !== null && c !== undefined && c !== false && c !== true)
    .map((c) =>
      typeof c === 'string' || typeof c === 'number'
        ? ({ type: '__text__', props: { nodeValue: String(c), children: [] } } as VNode)
        : (c as VNode)
    );

  return {
    type,
    props: { ...(props ?? {}), children },
  };
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useState<S>(initialState: S | (() => S)): [S, (newState: S | ((prev: S) => S)) => void] {
  if (!currentComponent) {
    throw new Error('useState called outside of a component');
  }

  const hooks = currentComponent;
  const index = hooks.stateIndex++;

  if (index >= hooks.states.length) {
    hooks.states[index] = typeof initialState === 'function'
      ? (initialState as () => S)()
      : initialState;
  }

  const setState = (newState: S | ((prev: S) => S)) => {
    const prev = hooks.states[index] as S;
    hooks.states[index] = typeof newState === 'function'
      ? (newState as (prev: S) => S)(prev)
      : newState;
    scheduleRerender();
  };

  return [hooks.states[index] as S, setState];
}

export function useEffect(callback: () => (() => void) | void, deps?: unknown[]): void {
  if (!currentComponent) {
    throw new Error('useEffect called outside of a component');
  }

  const hooks = currentComponent;
  const index = hooks.effectIndex++;

  if (index >= hooks.effects.length) {
    // First run – schedule the effect
    hooks.effects[index] = { deps, cleanup: undefined, callback };
    pendingEffects.push({ record: hooks.effects[index] });
    return;
  }

  const prev = hooks.effects[index];
  const hasChanged =
    deps === undefined ||
    prev.deps === undefined ||
    deps.length !== prev.deps.length ||
    deps.some((d, i) => !Object.is(d, prev.deps![i]));

  if (hasChanged) {
    prev.deps = deps;
    prev.callback = callback;
    pendingEffects.push({ record: prev, runCleanup: true });
  }
}

// ─── Effects Queue ───────────────────────────────────────────────────────────

interface PendingEffect {
  record: EffectRecord;
  runCleanup?: boolean;
}

const pendingEffects: PendingEffect[] = [];

function flushEffects(): void {
  const batch = pendingEffects.splice(0);
  for (const { record, runCleanup } of batch) {
    if (runCleanup && typeof record.cleanup === 'function') {
      record.cleanup();
    }
    record.cleanup = record.callback();
  }
}

// ─── Rerender Scheduler ──────────────────────────────────────────────────────

let rerenderScheduled = false;

function scheduleRerender(): void {
  if (rerenderScheduled) return;
  rerenderScheduled = true;
  // Use microtask queue (Promise) to batch multiple setState calls
  Promise.resolve().then(() => {
    rerenderScheduled = false;
    for (const [container, entry] of renderRoots.entries()) {
      if (!entry) continue;
      // Re-resolve from the original source vnode (re-runs function components)
      const nextResolved = resolveVNode(entry.source);
      diff(container, entry.resolved, nextResolved);
      renderRoots.set(container, { source: entry.source, resolved: nextResolved });
    }
    flushEffects();
  });
}

/** Re-invoke a vnode tree, re-running function components so hooks fire */
function rerender(vnode: VNode): VNode {
  if (typeof vnode.type === 'function') {
    const fn = vnode.type;
    const key = fn as object;
    let hooks = componentHooks.get(key);
    if (!hooks) {
      hooks = { states: [], effects: [], stateIndex: 0, effectIndex: 0 };
      componentHooks.set(key, hooks);
    }
    hooks.stateIndex = 0;
    hooks.effectIndex = 0;
    currentComponent = hooks;
    const result = fn(vnode.props) ?? createElement('div', null);
    currentComponent = null;
    return rerender(result);
  }

  const children = (vnode.props.children ?? []) as VNode[];
  return {
    type: vnode.type,
    props: {
      ...vnode.props,
      children: children.map(rerender),
    },
  };
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────

function createDOMNode(vnode: VNode): Node {
  if (vnode.type === '__text__') {
    return document.createTextNode(String(vnode.props.nodeValue ?? ''));
  }

  const el = document.createElement(vnode.type as string);
  applyProps(el, {}, vnode.props);

  for (const child of (vnode.props.children ?? []) as VNode[]) {
    el.appendChild(createDOMNode(child));
  }

  return el;
}

function applyProps(
  el: HTMLElement,
  prevProps: Props,
  nextProps: Props
): void {
  // Remove old props
  for (const key of Object.keys(prevProps)) {
    if (key === 'children') continue;
    if (!(key in nextProps)) {
      if (key.startsWith('on')) {
        const event = key.slice(2).toLowerCase();
        el.removeEventListener(event, prevProps[key] as EventListener);
      } else {
        el.removeAttribute(key);
      }
    }
  }

  // Set new / changed props
  for (const [key, value] of Object.entries(nextProps)) {
    if (key === 'children') continue;
    if (prevProps[key] === value) continue;

    if (key.startsWith('on') && typeof value === 'function') {
      const event = key.slice(2).toLowerCase();
      if (prevProps[key]) {
        el.removeEventListener(event, prevProps[key] as EventListener);
      }
      el.addEventListener(event, value as EventListener);
    } else if (key === 'style' && typeof value === 'object' && value !== null) {
      Object.assign(el.style, value);
    } else if (key === 'className') {
      el.setAttribute('class', String(value));
    } else if (key === 'htmlFor') {
      el.setAttribute('for', String(value));
    } else if (typeof value === 'boolean') {
      if (value) el.setAttribute(key, '');
      else el.removeAttribute(key);
    } else if (value !== null && value !== undefined) {
      el.setAttribute(key, String(value));
    }
  }
}

// ─── Diff Algorithm ───────────────────────────────────────────────────────────

/**
 * Reconcile the real DOM under `parent` from `prevVNode` → `nextVNode`.
 * `childIndex` is the child position inside parent (used when prev is null).
 */
export function diff(
  parent: Element | Node,
  prevVNode: VNode | null,
  nextVNode: VNode | null,
  childIndex = 0
): void {
  // Case 1: nothing before, something now → append
  if (!prevVNode && nextVNode) {
    parent.appendChild(createDOMNode(nextVNode));
    return;
  }

  // Case 2: something before, nothing now → remove
  if (prevVNode && !nextVNode) {
    const child = parent.childNodes[childIndex];
    if (child) parent.removeChild(child);
    return;
  }

  if (!prevVNode || !nextVNode) return;

  const domNode = parent.childNodes[childIndex];

  // Case 3: type changed → replace
  if (prevVNode.type !== nextVNode.type) {
    parent.replaceChild(createDOMNode(nextVNode), domNode);
    return;
  }

  // Case 4: text node update
  if (nextVNode.type === '__text__') {
    if (prevVNode.props.nodeValue !== nextVNode.props.nodeValue) {
      domNode.nodeValue = String(nextVNode.props.nodeValue ?? '');
    }
    return;
  }

  // Case 5: same element type → patch props and recurse into children
  applyProps(domNode as HTMLElement, prevVNode.props, nextVNode.props);

  const prevChildren = (prevVNode.props.children ?? []) as VNode[];
  const nextChildren = (nextVNode.props.children ?? []) as VNode[];
  const maxLen = Math.max(prevChildren.length, nextChildren.length);

  for (let i = 0; i < maxLen; i++) {
    diff(
      domNode,
      prevChildren[i] ?? null,
      nextChildren[i] ?? null,
      i
    );
  }
}

// ─── render ───────────────────────────────────────────────────────────────────

/**
 * Render a VNode into a container DOM element (replaces innerHTML).
 */
export function render(vnode: VNode | null, container: Element): void {
  const entry = renderRoots.get(container) ?? null;

  // Resolve function components → concrete VNode tree
  const resolvedNext = vnode ? resolveVNode(vnode) : null;
  const resolvedPrev = entry?.resolved ?? null;

  if (!entry) {
    // First render
    if (resolvedNext) {
      container.appendChild(createDOMNode(resolvedNext));
    }
  } else {
    diff(container, resolvedPrev, resolvedNext);
  }

  renderRoots.set(container, vnode && resolvedNext ? { source: vnode, resolved: resolvedNext } : null);
  flushEffects();
}

/**
 * Fully resolve a vnode tree: call function components, expand children.
 */
function resolveVNode(vnode: VNode): VNode {
  if (typeof vnode.type === 'function') {
    const fn = vnode.type;
    const key = fn as object;

    let hooks = componentHooks.get(key);
    if (!hooks) {
      hooks = { states: [], effects: [], stateIndex: 0, effectIndex: 0 };
      componentHooks.set(key, hooks);
    }
    hooks.stateIndex = 0;
    hooks.effectIndex = 0;
    currentComponent = hooks;
    const result = fn(vnode.props) ?? createElement('div', null);
    currentComponent = null;
    return resolveVNode(result);
  }

  const children = (vnode.props.children ?? []) as VNode[];
  return {
    type: vnode.type,
    props: {
      ...vnode.props,
      children: children.map(resolveVNode),
    },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

const MiniReact = {
  createElement,
  render,
  useState,
  useEffect,
};

export default MiniReact;
