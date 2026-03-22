/**
 * Tests for mini-vdom
 *
 * Uses jsdom (via jest-environment-jsdom) so we can interact with real DOM.
 */

import { h, mount, patch, VNode } from '../src/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function container(): Element {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
}

function cleanup(el: Element): void {
  document.body.removeChild(el);
}

// ---------------------------------------------------------------------------
// h() — VNode creation
// ---------------------------------------------------------------------------

describe('h()', () => {
  it('creates a VNode with correct type, props, children', () => {
    const vn = h('div', { id: 'app' }, 'hello');
    expect(vn.type).toBe('div');
    expect(vn.props).toEqual({ id: 'app' });
    // String children are normalised to text VNodes
    expect(vn.children).toHaveLength(1);
    expect(vn.children[0].type).toBeNull();
    expect(vn.children[0].text).toBe('hello');
    expect(vn.key).toBeNull();
  });

  it('handles null props', () => {
    const vn = h('span', null, 'text');
    expect(vn.props).toEqual({});
  });

  it('extracts key from props', () => {
    const vn = h('li', { key: 'a' }, 'item');
    expect(vn.key).toBe('a');
  });

  it('flattens nested children arrays', () => {
    const children = [['a', 'b'], 'c'];
    const vn = h('ul', null, ...(children as Parameters<typeof h>[2][]));
    // Flat list of 3 text VNodes
    expect(vn.children).toHaveLength(3);
    expect(vn.children.map((c) => c.text)).toEqual(['a', 'b', 'c']);
  });

  it('accepts number key', () => {
    const vn = h('li', { key: 1 }, 'x');
    expect(vn.key).toBe('1');
  });
});

// ---------------------------------------------------------------------------
// mount()
// ---------------------------------------------------------------------------

describe('mount()', () => {
  it('creates element with correct tag', () => {
    const c = container();
    mount(h('p', null, 'hello'), c);
    expect(c.querySelector('p')).not.toBeNull();
    cleanup(c);
  });

  it('sets text content', () => {
    const c = container();
    mount(h('p', null, 'hello world'), c);
    expect(c.querySelector('p')!.textContent).toBe('hello world');
    cleanup(c);
  });

  it('sets attributes', () => {
    const c = container();
    mount(h('input', { type: 'text', placeholder: 'Enter' }), c);
    const el = c.querySelector('input')!;
    expect(el.getAttribute('type')).toBe('text');
    expect(el.getAttribute('placeholder')).toBe('Enter');
    cleanup(c);
  });

  it('sets class attribute', () => {
    const c = container();
    mount(h('div', { class: 'box red' }), c);
    expect(c.querySelector('div')!.getAttribute('class')).toBe('box red');
    cleanup(c);
  });

  it('attaches event listeners', () => {
    const c = container();
    let clicked = false;
    mount(h('button', { onClick: () => { clicked = true; } }, 'click me'), c);
    (c.querySelector('button')! as HTMLButtonElement).click();
    expect(clicked).toBe(true);
    cleanup(c);
  });

  it('handles nested children', () => {
    const c = container();
    mount(
      h('ul', null,
        h('li', null, 'a'),
        h('li', null, 'b'),
        h('li', null, 'c'),
      ),
      c,
    );
    const items = c.querySelectorAll('li');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toBe('a');
    expect(items[2].textContent).toBe('c');
    cleanup(c);
  });
});

// ---------------------------------------------------------------------------
// patch() — text update
// ---------------------------------------------------------------------------

describe('patch() — text nodes', () => {
  it('updates text content', () => {
    const c = container();
    const v1 = h('p', null, 'old text');
    mount(v1, c);

    const v2 = h('p', null, 'new text');
    patch(v1, v2, c);

    expect(c.querySelector('p')!.textContent).toBe('new text');
    cleanup(c);
  });
});

// ---------------------------------------------------------------------------
// patch() — props update
// ---------------------------------------------------------------------------

describe('patch() — props', () => {
  it('adds new attribute', () => {
    const c = container();
    const v1 = h('div', {});
    mount(v1, c);

    const v2 = h('div', { id: 'new' });
    patch(v1, v2, c);

    expect(c.querySelector('div')!.getAttribute('id')).toBe('new');
    cleanup(c);
  });

  it('removes removed attribute', () => {
    const c = container();
    const v1 = h('div', { id: 'old' });
    mount(v1, c);

    const v2 = h('div', {});
    patch(v1, v2, c);

    expect(c.querySelector('div')!.getAttribute('id')).toBeNull();
    cleanup(c);
  });

  it('updates changed attribute', () => {
    const c = container();
    const v1 = h('div', { id: 'a' });
    mount(v1, c);

    const v2 = h('div', { id: 'b' });
    patch(v1, v2, c);

    expect(c.querySelector('div')!.getAttribute('id')).toBe('b');
    cleanup(c);
  });

  it('updates event listener', () => {
    const c = container();
    let count = 0;
    const v1 = h('button', { onClick: () => { count += 1; } }, 'btn');
    mount(v1, c);

    const v2 = h('button', { onClick: () => { count += 10; } }, 'btn');
    patch(v1, v2, c);

    (c.querySelector('button')! as HTMLButtonElement).click();
    expect(count).toBe(10);
    cleanup(c);
  });
});

// ---------------------------------------------------------------------------
// patch() — type change (replacement)
// ---------------------------------------------------------------------------

describe('patch() — element type change', () => {
  it('replaces element when type changes', () => {
    const c = container();
    const v1 = h('div', { id: 'old' }, 'text');
    mount(v1, c);

    const v2 = h('span', { id: 'new' }, 'text');
    patch(v1, v2, c);

    expect(c.querySelector('div')).toBeNull();
    expect(c.querySelector('span')).not.toBeNull();
    cleanup(c);
  });
});

// ---------------------------------------------------------------------------
// patch() — unkeyed children reconciliation
// ---------------------------------------------------------------------------

describe('patch() — unkeyed children', () => {
  it('adds new children', () => {
    const c = container();
    const v1 = h('ul', null, h('li', null, 'a'));
    mount(v1, c);

    const v2 = h('ul', null, h('li', null, 'a'), h('li', null, 'b'));
    patch(v1, v2, c);

    expect(c.querySelectorAll('li').length).toBe(2);
    cleanup(c);
  });

  it('removes extra children', () => {
    const c = container();
    const v1 = h('ul', null,
      h('li', null, 'a'),
      h('li', null, 'b'),
      h('li', null, 'c'),
    );
    mount(v1, c);

    const v2 = h('ul', null, h('li', null, 'a'));
    patch(v1, v2, c);

    expect(c.querySelectorAll('li').length).toBe(1);
    cleanup(c);
  });

  it('updates existing children in place', () => {
    const c = container();
    const v1 = h('ul', null, h('li', null, 'a'), h('li', null, 'b'));
    mount(v1, c);

    const v2 = h('ul', null, h('li', null, 'x'), h('li', null, 'y'));
    patch(v1, v2, c);

    const items = c.querySelectorAll('li');
    expect(items[0].textContent).toBe('x');
    expect(items[1].textContent).toBe('y');
    cleanup(c);
  });
});

// ---------------------------------------------------------------------------
// patch() — keyed children reconciliation
// ---------------------------------------------------------------------------

describe('patch() — keyed children', () => {
  it('reuses DOM nodes when key matches', () => {
    const c = container();
    const v1 = h('ul', null,
      h('li', { key: 'a' }, 'Item A'),
      h('li', { key: 'b' }, 'Item B'),
    );
    mount(v1, c);
    const liA = c.querySelectorAll('li')[0];

    // Same keys, same order
    const v2 = h('ul', null,
      h('li', { key: 'a' }, 'Item A updated'),
      h('li', { key: 'b' }, 'Item B'),
    );
    patch(v1, v2, c);

    // Same DOM node reused for key 'a'
    expect(c.querySelectorAll('li')[0]).toBe(liA);
    expect(c.querySelectorAll('li')[0].textContent).toBe('Item A updated');
    cleanup(c);
  });

  it('removes nodes whose key disappears', () => {
    const c = container();
    const v1 = h('ul', null,
      h('li', { key: 'a' }, 'A'),
      h('li', { key: 'b' }, 'B'),
      h('li', { key: 'c' }, 'C'),
    );
    mount(v1, c);

    const v2 = h('ul', null,
      h('li', { key: 'a' }, 'A'),
      h('li', { key: 'c' }, 'C'),
    );
    patch(v1, v2, c);

    expect(c.querySelectorAll('li').length).toBe(2);
    expect(c.querySelectorAll('li')[1].textContent).toBe('C');
    cleanup(c);
  });

  it('adds nodes with new keys', () => {
    const c = container();
    const v1 = h('ul', null,
      h('li', { key: 'a' }, 'A'),
    );
    mount(v1, c);

    const v2 = h('ul', null,
      h('li', { key: 'a' }, 'A'),
      h('li', { key: 'b' }, 'B'),
      h('li', { key: 'c' }, 'C'),
    );
    patch(v1, v2, c);

    expect(c.querySelectorAll('li').length).toBe(3);
    cleanup(c);
  });

  it('handles full key reversal', () => {
    const c = container();
    const v1 = h('ul', null,
      h('li', { key: '1' }, '1'),
      h('li', { key: '2' }, '2'),
      h('li', { key: '3' }, '3'),
    );
    mount(v1, c);

    const v2 = h('ul', null,
      h('li', { key: '3' }, '3'),
      h('li', { key: '2' }, '2'),
      h('li', { key: '1' }, '1'),
    );
    patch(v1, v2, c);

    const items = c.querySelectorAll('li');
    expect(items[0].textContent).toBe('3');
    expect(items[1].textContent).toBe('2');
    expect(items[2].textContent).toBe('1');
    cleanup(c);
  });

  it('handles mixed add/remove/reorder', () => {
    const c = container();
    const v1 = h('ul', null,
      h('li', { key: 'a' }, 'A'),
      h('li', { key: 'b' }, 'B'),
      h('li', { key: 'c' }, 'C'),
      h('li', { key: 'd' }, 'D'),
    );
    mount(v1, c);

    const v2 = h('ul', null,
      h('li', { key: 'c' }, 'C'),
      h('li', { key: 'a' }, 'A'),
      h('li', { key: 'e' }, 'E'),
      h('li', { key: 'b' }, 'B'),
    );
    patch(v1, v2, c);

    const items = c.querySelectorAll('li');
    expect(items.length).toBe(4);
    expect(items[0].textContent).toBe('C');
    expect(items[1].textContent).toBe('A');
    expect(items[2].textContent).toBe('E');
    expect(items[3].textContent).toBe('B');
    cleanup(c);
  });
});

// ---------------------------------------------------------------------------
// Nested patch
// ---------------------------------------------------------------------------

describe('patch() — nested updates', () => {
  it('recursively patches nested elements', () => {
    const c = container();
    const v1 = h('div', null,
      h('p', { class: 'old' }, 'paragraph'),
    );
    mount(v1, c);

    const v2 = h('div', null,
      h('p', { class: 'new' }, 'updated paragraph'),
    );
    patch(v1, v2, c);

    const p = c.querySelector('p')!;
    expect(p.getAttribute('class')).toBe('new');
    expect(p.textContent).toBe('updated paragraph');
    cleanup(c);
  });
});
