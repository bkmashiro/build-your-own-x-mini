/**
 * MiniReact test suite
 *
 * Tests:
 * - createElement
 * - render (initial + update)
 * - Function components
 * - useState
 * - useEffect
 * - Diff algorithm (add / remove / replace / patch)
 */

import { createElement, render, useState, useEffect, diff, VNode } from '../src/index';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeContainer(): HTMLDivElement {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
}

function cleanup(container: HTMLElement): void {
  document.body.removeChild(container);
}

// ─── createElement ────────────────────────────────────────────────────────────

describe('createElement', () => {
  it('creates a vnode with type and props', () => {
    const vnode = createElement('div', { id: 'foo' });
    expect(vnode.type).toBe('div');
    expect(vnode.props.id).toBe('foo');
    expect(vnode.props.children).toEqual([]);
  });

  it('wraps string children as text vnodes', () => {
    const vnode = createElement('p', null, 'hello');
    const children = vnode.props.children as VNode[];
    expect(children).toHaveLength(1);
    expect(children[0].type).toBe('__text__');
    expect(children[0].props.nodeValue).toBe('hello');
  });

  it('supports number children', () => {
    const vnode = createElement('span', null, 42);
    const children = vnode.props.children as VNode[];
    expect(children[0].props.nodeValue).toBe('42');
  });

  it('filters out null / undefined / boolean children', () => {
    const vnode = createElement('div', null, null, undefined, false, true, 'real');
    const children = vnode.props.children as VNode[];
    expect(children).toHaveLength(1);
    expect(children[0].props.nodeValue).toBe('real');
  });

  it('nests child vnodes', () => {
    const child = createElement('span', null, 'inner');
    const parent = createElement('div', null, child);
    const children = parent.props.children as VNode[];
    expect(children[0]).toBe(child);
  });
});

// ─── render ───────────────────────────────────────────────────────────────────

describe('render', () => {
  it('renders a simple element to the DOM', () => {
    const container = makeContainer();
    render(createElement('h1', null, 'Hello'), container);
    expect(container.querySelector('h1')?.textContent).toBe('Hello');
    cleanup(container);
  });

  it('renders nested elements', () => {
    const container = makeContainer();
    render(
      createElement('ul', null,
        createElement('li', null, 'a'),
        createElement('li', null, 'b'),
      ),
      container
    );
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('a');
    expect(items[1].textContent).toBe('b');
    cleanup(container);
  });

  it('sets attributes on elements', () => {
    const container = makeContainer();
    render(createElement('input', { type: 'text', id: 'myInput' }), container);
    const input = container.querySelector('input');
    expect(input?.getAttribute('type')).toBe('text');
    expect(input?.getAttribute('id')).toBe('myInput');
    cleanup(container);
  });

  it('re-render updates text content', () => {
    const container = makeContainer();
    render(createElement('p', null, 'v1'), container);
    expect(container.querySelector('p')?.textContent).toBe('v1');

    render(createElement('p', null, 'v2'), container);
    expect(container.querySelector('p')?.textContent).toBe('v2');
    cleanup(container);
  });

  it('re-render adds new children', () => {
    const container = makeContainer();
    render(createElement('div', null, createElement('span', null, 'a')), container);
    render(
      createElement('div', null,
        createElement('span', null, 'a'),
        createElement('span', null, 'b'),
      ),
      container
    );
    expect(container.querySelectorAll('span')).toHaveLength(2);
    cleanup(container);
  });

  it('re-render removes extra children', () => {
    const container = makeContainer();
    render(
      createElement('div', null,
        createElement('span', null, 'a'),
        createElement('span', null, 'b'),
      ),
      container
    );
    render(createElement('div', null, createElement('span', null, 'a')), container);
    expect(container.querySelectorAll('span')).toHaveLength(1);
    cleanup(container);
  });
});

// ─── Function Components ──────────────────────────────────────────────────────

describe('Function components', () => {
  it('renders a function component', () => {
    const Greeting = ({ name }: { name: string; children?: VNode[] }) =>
      createElement('p', null, `Hello, ${name}!`);

    const container = makeContainer();
    render(createElement(Greeting, { name: 'World' }), container);
    expect(container.querySelector('p')?.textContent).toBe('Hello, World!');
    cleanup(container);
  });

  it('renders nested function components', () => {
    const Inner = ({ text }: { text: string; children?: VNode[] }) =>
      createElement('em', null, text);

    const Outer = (_props: { children?: VNode[] }) =>
      createElement('div', null, createElement(Inner, { text: 'nested' }));

    const container = makeContainer();
    render(createElement(Outer, null), container);
    expect(container.querySelector('em')?.textContent).toBe('nested');
    cleanup(container);
  });
});

// ─── useState ─────────────────────────────────────────────────────────────────

describe('useState', () => {
  it('provides initial state', () => {
    let capturedCount: number | undefined;

    const Counter = (_: { children?: VNode[] }) => {
      const [count] = useState(0);
      capturedCount = count;
      return createElement('span', null, String(count));
    };

    const container = makeContainer();
    render(createElement(Counter, null), container);
    expect(capturedCount).toBe(0);
    cleanup(container);
  });

  it('accepts a function as initial state', () => {
    let capturedValue: number | undefined;

    const Comp = (_: { children?: VNode[] }) => {
      const [val] = useState(() => 42);
      capturedValue = val;
      return createElement('span', null, String(val));
    };

    const container = makeContainer();
    render(createElement(Comp, null), container);
    expect(capturedValue).toBe(42);
    cleanup(container);
  });

  it('setState triggers DOM update asynchronously', async () => {
    let setter: (v: number) => void = () => {};

    const Counter = (_: { children?: VNode[] }) => {
      const [count, setCount] = useState(0);
      setter = setCount;
      return createElement('div', null, String(count));
    };

    const container = makeContainer();
    render(createElement(Counter, null), container);
    expect(container.textContent).toBe('0');

    setter(5);
    // Wait for the microtask queue to flush
    await Promise.resolve();
    await Promise.resolve();

    expect(container.textContent).toBe('5');
    cleanup(container);
  });

  it('setState with updater function', async () => {
    let increment: () => void = () => {};

    const Counter = (_: { children?: VNode[] }) => {
      const [count, setCount] = useState(0);
      increment = () => setCount((c) => c + 1);
      return createElement('div', null, String(count));
    };

    const container = makeContainer();
    render(createElement(Counter, null), container);

    increment();
    await Promise.resolve();
    await Promise.resolve();
    expect(container.textContent).toBe('1');

    increment();
    await Promise.resolve();
    await Promise.resolve();
    expect(container.textContent).toBe('2');

    cleanup(container);
  });
});

// ─── useEffect ────────────────────────────────────────────────────────────────

describe('useEffect', () => {
  it('runs effect after render', () => {
    const log: string[] = [];

    const Comp = (_: { children?: VNode[] }) => {
      useEffect(() => {
        log.push('effect ran');
      }, []);
      return createElement('div', null);
    };

    const container = makeContainer();
    render(createElement(Comp, null), container);
    expect(log).toContain('effect ran');
    cleanup(container);
  });

  it('runs cleanup on re-run when deps change', async () => {
    const log: string[] = [];
    let setVal: (v: number) => void = () => {};

    const Comp = (_: { children?: VNode[] }) => {
      const [val, setV] = useState(0);
      setVal = setV;
      useEffect(() => {
        log.push(`effect:${val}`);
        return () => log.push(`cleanup:${val}`);
      }, [val]);
      return createElement('div', null, String(val));
    };

    const container = makeContainer();
    render(createElement(Comp, null), container);
    expect(log).toContain('effect:0');

    setVal(1);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(log).toContain('cleanup:0');
    expect(log).toContain('effect:1');
    cleanup(container);
  });

  it('does NOT re-run effect when deps are unchanged', async () => {
    const log: string[] = [];
    let forceUpdate: () => void = () => {};

    const Comp = (_: { children?: VNode[] }) => {
      const [tick, setTick] = useState(0);
      forceUpdate = () => setTick((t) => t + 1);
      useEffect(() => {
        log.push('effect');
      }, []); // empty deps → run once only
      return createElement('div', null, String(tick));
    };

    const container = makeContainer();
    render(createElement(Comp, null), container);
    expect(log).toHaveLength(1);

    forceUpdate();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(log).toHaveLength(1); // still only ran once
    cleanup(container);
  });
});

// ─── Diff Algorithm ───────────────────────────────────────────────────────────

describe('diff', () => {
  it('adds a node when prevVNode is null', () => {
    const container = makeContainer();
    diff(container, null, createElement('span', null, 'new'));
    expect(container.querySelector('span')?.textContent).toBe('new');
    cleanup(container);
  });

  it('removes a node when nextVNode is null', () => {
    const container = makeContainer();
    container.appendChild(document.createElement('span'));
    diff(container, createElement('span', null), null, 0);
    expect(container.querySelector('span')).toBeNull();
    cleanup(container);
  });

  it('replaces a node when type changes', () => {
    const container = makeContainer();
    // Render initial node
    render(createElement('div', null, createElement('p', null, 'old')), container);
    // Diff the child: p → section
    const parent = container.firstChild as Element;
    diff(
      parent,
      createElement('p', null, 'old'),
      createElement('section', null, 'new'),
      0
    );
    expect(parent.querySelector('section')?.textContent).toBe('new');
    expect(parent.querySelector('p')).toBeNull();
    cleanup(container);
  });

  it('patches text content without replacing the node', () => {
    const container = makeContainer();
    render(createElement('p', null, 'v1'), container);
    const pElem = container.querySelector('p')!;
    diff(
      container,
      createElement('p', null, 'v1'),
      createElement('p', null, 'v2'),
      0
    );
    // The same <p> element should still be in the DOM
    expect(container.querySelector('p')).toBe(pElem);
    expect(pElem.textContent).toBe('v2');
    cleanup(container);
  });

  it('patches attributes without replacing element', () => {
    const container = makeContainer();
    render(createElement('div', { id: 'a' }), container);
    const div = container.querySelector('div')!;
    diff(
      container,
      createElement('div', { id: 'a' }),
      createElement('div', { id: 'b' }),
      0
    );
    expect(container.querySelector('div')).toBe(div); // same node
    expect(div.getAttribute('id')).toBe('b');
    cleanup(container);
  });
});
