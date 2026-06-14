import { describe, it, expect, beforeEach } from 'vitest';
import { serializeInteractive, isInteractive, isVisible } from '../src/core/dom-serializer.js';

const setBody = (html) => { document.body.innerHTML = html; };
beforeEach(() => { document.body.innerHTML = ''; });

describe('isInteractive', () => {
  it('detects links, buttons, inputs, roles', () => {
    setBody('<a href="#">l</a><a>nohref</a><button>b</button><input><input type="hidden"><div role="button">x</div><span>plain</span>');
    const [a1, a2] = document.querySelectorAll('a');
    expect(isInteractive(a1)).toBe(true);
    expect(isInteractive(a2)).toBe(false);
    expect(isInteractive(document.querySelector('button'))).toBe(true);
    const [i1, i2] = document.querySelectorAll('input');
    expect(isInteractive(i1)).toBe(true);
    expect(isInteractive(i2)).toBe(false); // hidden
    expect(isInteractive(document.querySelector('div'))).toBe(true);
    expect(isInteractive(document.querySelector('span'))).toBe(false);
  });
});

describe('isVisible', () => {
  it('excludes display:none and aria-hidden', () => {
    setBody('<button style="display:none">a</button><button aria-hidden="true">b</button><button>c</button>');
    const [a, b, c] = document.querySelectorAll('button');
    expect(isVisible(a)).toBe(false);
    expect(isVisible(b)).toBe(false);
    expect(isVisible(c)).toBe(true);
  });
});

describe('serializeInteractive', () => {
  it('indexes interactive elements in document order with a resolving map', () => {
    setBody('<input name="q" placeholder="Query"><button data-testid="go">Search</button><p>ignored</p>');
    const { text, map, count } = serializeInteractive(document);
    expect(count).toBe(2);
    expect(map.get(0)).toBe(document.querySelector('input'));
    expect(map.get(1)).toBe(document.querySelector('button'));
    expect(text).toContain('[0]<input');
    expect(text).toContain('placeholder="Query"');
    expect(text).toContain('[1]<button');
    expect(text).toContain('Search');
  });

  it('skips hidden elements', () => {
    setBody('<button style="display:none">hidden</button><button>shown</button>');
    const { count, map } = serializeInteractive(document);
    expect(count).toBe(1);
    expect(map.get(0).textContent).toBe('shown');
  });

  it('respects the max cap', () => {
    setBody(Array.from({ length: 10 }, (_, i) => `<button>b${i}</button>`).join(''));
    const { count } = serializeInteractive(document, { max: 3 });
    expect(count).toBe(3);
  });
});
