/**
 * mini-vdom — Minimal Virtual DOM with diff & patch
 *
 * Supports:
 *  - h()     : create VNode
 *  - mount() : mount VNode to a real DOM container
 *  - patch() : reconcile two VNode trees and update the real DOM
 *  - key optimised list diff (LIS-based move minimisation)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Props = Record<string, unknown>;

/**
 * A VNode represents either:
 *  - an element node  (type = tag string, e.g. "div")
 *  - a text node      (type = null, text = string content)
 */
export interface VNode {
  type: string | null;
  props: Props;
  children: VNode[];   // always VNode after normalisation
  key: string | null;
  text?: string;       // only for text nodes (type === null)
  _el?: Node;          // reference to real DOM node (set during mount/patch)
}

/** Raw child value that can be passed to h() */
export type VChild = VNode | string | number | boolean | null | undefined;

// ---------------------------------------------------------------------------
// h() — hyperscript factory
// ---------------------------------------------------------------------------

export function h(
  type: string,
  props: Props | null,
  ...rawChildren: VChild[]
): VNode {
  const children = normaliseChildren(rawChildren);
  const rawProps = props ?? {};
  const key = rawProps.key != null ? String(rawProps.key) : null;

  return { type, props: rawProps, children, key };
}

/** Flatten and convert raw children to VNodes */
function normaliseChildren(raw: VChild[]): VNode[] {
  const out: VNode[] = [];
  flattenTo(raw, out);
  return out;
}

function flattenTo(arr: VChild[], out: VNode[]): void {
  for (const c of arr) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) {
      flattenTo(c as VChild[], out);
    } else if (typeof c === 'object') {
      out.push(c as VNode);
    } else {
      // string | number | true → text VNode
      out.push(createTextVNode(String(c)));
    }
  }
}

function createTextVNode(text: string): VNode {
  return { type: null, props: {}, children: [], key: null, text };
}

// ---------------------------------------------------------------------------
// mount() — first render
// ---------------------------------------------------------------------------

export function mount(vnode: VNode, container: Element): void {
  container.appendChild(createElement(vnode));
}

function createElement(vnode: VNode): Node {
  if (vnode.type === null) {
    // Text node
    const node = document.createTextNode(vnode.text ?? '');
    vnode._el = node;
    return node;
  }

  const el = document.createElement(vnode.type);
  vnode._el = el;

  patchProps(el, {}, vnode.props);

  for (const child of vnode.children) {
    el.appendChild(createElement(child));
  }

  return el;
}

// ---------------------------------------------------------------------------
// patchProps — reconcile attributes / event listeners
// ---------------------------------------------------------------------------

export function patchProps(el: Element, oldProps: Props, newProps: Props): void {
  // Remove keys that no longer exist
  for (const key in oldProps) {
    if (key === 'key') continue;
    if (!(key in newProps)) removeProp(el, key, oldProps[key]);
  }
  // Set new / changed values
  for (const key in newProps) {
    if (key === 'key') continue;
    if (oldProps[key] !== newProps[key]) setProp(el, key, newProps[key], oldProps[key]);
  }
}

function setProp(el: Element, key: string, value: unknown, old?: unknown): void {
  if (key.startsWith('on')) {
    const event = key.slice(2).toLowerCase();
    if (old != null) el.removeEventListener(event, old as EventListener);
    if (value != null) el.addEventListener(event, value as EventListener);
    return;
  }
  if (key === 'class' || key === 'className') {
    el.setAttribute('class', String(value ?? ''));
    return;
  }
  if (key === 'style' && typeof value === 'object' && value !== null) {
    Object.assign((el as HTMLElement).style, value);
    return;
  }
  if (key in el) {
    (el as unknown as Record<string, unknown>)[key] = value;
    return;
  }
  if (value == null || value === false) {
    el.removeAttribute(key);
  } else {
    el.setAttribute(key, String(value));
  }
}

function removeProp(el: Element, key: string, value: unknown): void {
  if (key.startsWith('on')) {
    el.removeEventListener(key.slice(2).toLowerCase(), value as EventListener);
  } else if (key === 'class' || key === 'className') {
    el.removeAttribute('class');
  } else {
    el.removeAttribute(key);
  }
}

// ---------------------------------------------------------------------------
// patch() — reconcile old and new VNode trees
// ---------------------------------------------------------------------------

/**
 * Reconcile newVNode against oldVNode and update the real DOM.
 * `container` is the parent element that owns both nodes.
 */
export function patch(oldVNode: VNode, newVNode: VNode, container: Element): VNode {
  return patchNode(oldVNode, newVNode, container);
}

function patchNode(old: VNode, next: VNode, container: Element): VNode {
  if (old.type !== next.type) {
    // Different type → replace entirely
    const newEl = createElement(next);
    container.replaceChild(newEl, old._el!);
    return next;
  }

  // Same type — reuse DOM node
  next._el = old._el;

  if (next.type === null) {
    // Text node — update text content if changed
    if (old.text !== next.text) {
      (next._el as Text).data = next.text ?? '';
    }
    return next;
  }

  // Element node — patch props then children
  patchProps(next._el as Element, old.props, next.props);
  patchChildren(old.children, next.children, next._el as Element);

  return next;
}

// ---------------------------------------------------------------------------
// patchChildren — dispatch to keyed or unkeyed
// ---------------------------------------------------------------------------

function patchChildren(
  oldChildren: VNode[],
  newChildren: VNode[],
  el: Element,
): void {
  const hasKeys = newChildren.some((c) => c.key != null);
  if (hasKeys) {
    patchKeyedChildren(oldChildren, newChildren, el);
  } else {
    patchUnkeyedChildren(oldChildren, newChildren, el);
  }
}

// ---------------------------------------------------------------------------
// Unkeyed (index-based) reconciliation — O(n)
// ---------------------------------------------------------------------------

function patchUnkeyedChildren(
  oldCh: VNode[],
  newCh: VNode[],
  el: Element,
): void {
  const common = Math.min(oldCh.length, newCh.length);

  for (let i = 0; i < common; i++) {
    patchNode(oldCh[i], newCh[i], el);
  }

  // Mount additional new nodes
  for (let i = common; i < newCh.length; i++) {
    el.appendChild(createElement(newCh[i]));
  }

  // Remove extra old nodes (from end to preserve live NodeList indices)
  for (let i = oldCh.length - 1; i >= newCh.length; i--) {
    if (oldCh[i]._el) el.removeChild(oldCh[i]._el!);
  }
}

// ---------------------------------------------------------------------------
// Keyed reconciliation — reuse by key, LIS-based move minimisation
// ---------------------------------------------------------------------------

function patchKeyedChildren(
  oldCh: VNode[],
  newCh: VNode[],
  el: Element,
): void {
  // Build key → old VNode map
  const oldKeyMap = new Map<string, VNode>();
  for (const vn of oldCh) {
    if (vn.key != null) oldKeyMap.set(vn.key, vn);
  }

  // newIndexToOldIndex[i]:
  //   0       = brand-new node (key not in old)
  //   j+1     = corresponds to oldCh[j]
  const newIndexToOldIndex: number[] = new Array(newCh.length).fill(0);

  // Patch matched nodes in-place
  for (let i = 0; i < newCh.length; i++) {
    const key = newCh[i].key;
    if (key != null && oldKeyMap.has(key)) {
      const oldVN = oldKeyMap.get(key)!;
      const oldIdx = oldCh.indexOf(oldVN);
      newIndexToOldIndex[i] = oldIdx + 1;
      patchNode(oldVN, newCh[i], el);
      oldKeyMap.delete(key);
    }
  }

  // Remove old nodes that were not matched
  for (const [, vn] of oldKeyMap) {
    if (vn._el) el.removeChild(vn._el);
  }

  // Mount brand-new nodes (those without _el yet)
  for (const vn of newCh) {
    if (!vn._el) createElement(vn); // sets vn._el
  }

  // Determine stable nodes (LIS = nodes already in order, no DOM moves needed)
  const lis = longestIncreasingSubsequence(newIndexToOldIndex);
  const stable = new Set(lis);

  // Walk backwards, inserting nodes that need to move
  let anchor: Node | null = null;
  for (let i = newCh.length - 1; i >= 0; i--) {
    const vn = newCh[i];
    if (!stable.has(i)) {
      el.insertBefore(vn._el!, anchor);
    }
    anchor = vn._el!;
  }
}

// ---------------------------------------------------------------------------
// Longest Increasing Subsequence — O(n log n), returns indices into the array
// ---------------------------------------------------------------------------

function longestIncreasingSubsequence(arr: number[]): number[] {
  // tails[i] = smallest ending value of an increasing subsequence of length i+1
  const tails: number[] = [];
  // idxOf[i] = index in `arr` that produced tails[i]
  const idxOf: number[] = [];
  // prev[i] = index in `arr` of the predecessor of arr[i] in its LIS chain
  const prev: number[] = new Array(arr.length).fill(-1);

  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v === 0) continue; // 0 = new node, skip

    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      tails[mid] < v ? (lo = mid + 1) : (hi = mid);
    }

    tails[lo] = v;
    idxOf[lo] = i;
    if (lo > 0) prev[i] = idxOf[lo - 1];
  }

  // Reconstruct index list
  if (idxOf.length === 0) return [];
  const result: number[] = [];
  let k = idxOf[tails.length - 1];
  while (k !== -1 && k !== undefined) {
    result.push(k);
    k = prev[k];
  }
  return result.reverse();
}
