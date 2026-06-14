import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeSelectorBundle,
  resolveSelectorBundle,
  isStableId,
  getRole,
  accessibleName,
  computeCssPath,
} from '../src/core/selector-engine.js';

function setBody(html) {
  document.body.innerHTML = html;
}

const topType = (el) => computeSelectorBundle(el).candidates[0].type;
const types = (el) => computeSelectorBundle(el).candidates.map((c) => c.type);

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('isStableId', () => {
  it('accepts human-authored ids', () => {
    expect(isStableId('login-button')).toBe(true);
    expect(isStableId('main_content')).toBe(true);
  });

  it('rejects framework-generated / dynamic ids', () => {
    expect(isStableId(':r0:')).toBe(false); // React useId
    expect(isStableId('react-select-2-input')).toBe(false);
    expect(isStableId('radix-:r1:-trigger')).toBe(false);
    expect(isStableId('ember1234')).toBe(false);
    expect(isStableId('a1b2c3d4e5')).toBe(false); // hex hash
    expect(isStableId('field-9281')).toBe(false); // long digit run
    expect(isStableId('')).toBe(false);
  });
});

describe('getRole', () => {
  it('uses explicit role', () => {
    setBody('<div role="button">x</div>');
    expect(getRole(document.querySelector('div'))).toBe('button');
  });
  it('infers implicit roles', () => {
    setBody('<a href="#">x</a><button>y</button><input type="checkbox"><textarea></textarea>');
    expect(getRole(document.querySelector('a'))).toBe('link');
    expect(getRole(document.querySelector('button'))).toBe('button');
    expect(getRole(document.querySelector('input'))).toBe('checkbox');
    expect(getRole(document.querySelector('textarea'))).toBe('textbox');
  });
  it('treats anchor without href as non-link', () => {
    setBody('<a>x</a>');
    expect(getRole(document.querySelector('a'))).toBe(null);
  });
});

describe('accessibleName', () => {
  it('prefers aria-label', () => {
    setBody('<button aria-label="Close dialog">x</button>');
    expect(accessibleName(document.querySelector('button'))).toBe('Close dialog');
  });
  it('resolves aria-labelledby', () => {
    setBody('<span id="lbl">Save file</span><button aria-labelledby="lbl">x</button>');
    expect(accessibleName(document.querySelector('button'))).toBe('Save file');
  });
  it('uses label[for] for inputs', () => {
    setBody('<label for="email">Email address</label><input id="email">');
    expect(accessibleName(document.querySelector('input'))).toBe('Email address');
  });
  it('uses wrapping label for inputs', () => {
    setBody('<label>Username <input type="text"></label>');
    expect(accessibleName(document.querySelector('input'))).toBe('Username');
  });
  it('falls back to placeholder', () => {
    setBody('<input placeholder="Search…">');
    expect(accessibleName(document.querySelector('input'))).toBe('Search…');
  });
  it('uses text content for buttons', () => {
    setBody('<button>  Log   in </button>');
    expect(accessibleName(document.querySelector('button'))).toBe('Log in');
  });
});

describe('computeSelectorBundle — priority', () => {
  it('prefers test id above all', () => {
    setBody('<button id="ok" name="ok" data-testid="submit">OK</button>');
    expect(topType(document.querySelector('button'))).toBe('testid');
  });

  it('uses stable id when no test id', () => {
    setBody('<button id="save-btn">Save</button>');
    expect(topType(document.querySelector('button'))).toBe('id');
  });

  it('skips dynamic id and falls through', () => {
    setBody('<button id="react-1234">Save</button>');
    const t = types(document.querySelector('button'));
    expect(t).not.toContain('id');
    // still resolvable by role+name / text / css / xpath
    expect(t).toContain('role+name');
  });

  it('uses name attribute for form fields', () => {
    setBody('<form><input name="username" type="text"></form>');
    const t = types(document.querySelector('input'));
    expect(t).toContain('name');
    expect(t[0]).toBe('name');
  });

  it('includes role+name for a labelled button', () => {
    setBody('<button>Continue</button>');
    const t = types(document.querySelector('button'));
    expect(t).toContain('role+name');
    expect(t).toContain('text');
  });

  it('always includes a css path and an xpath as fallbacks', () => {
    setBody('<div><section><p>hello</p></section></div>');
    const t = types(document.querySelector('p'));
    expect(t).toContain('css');
    expect(t).toContain('xpath');
  });

  it('omits non-unique text when two controls share it', () => {
    setBody('<button>Delete</button><button>Delete</button>');
    const first = document.querySelectorAll('button')[0];
    const t = types(first);
    expect(t).not.toContain('text');
    expect(t).not.toContain('role+name'); // also non-unique
    // still resolvable structurally
    expect(t).toContain('xpath');
  });
});

describe('computeCssPath', () => {
  it('anchors on a stable ancestor id', () => {
    setBody('<div id="panel"><ul><li>a</li><li><a href="#">link</a></li></ul></div>');
    const a = document.querySelector('a');
    const path = computeCssPath(a);
    expect(path.startsWith('#panel')).toBe(true);
    expect(document.querySelector(path)).toBe(a);
  });

  it('produces a body-anchored path when no stable ancestor', () => {
    setBody('<section><p>one</p><p>two</p></section>');
    const second = document.querySelectorAll('p')[1];
    const path = computeCssPath(second);
    expect(document.querySelector(path)).toBe(second);
  });
});

describe('resolveSelectorBundle — round trip', () => {
  it('finds the same element it was computed from', () => {
    setBody('<div id="app"><button data-testid="go">Go</button></div>');
    const btn = document.querySelector('button');
    const bundle = computeSelectorBundle(btn);
    const result = resolveSelectorBundle(bundle, document);
    expect(result?.element).toBe(btn);
    expect(result?.candidate.type).toBe('testid');
  });

  it('falls back to a lower-priority candidate when the top one breaks', () => {
    setBody('<div id="app"><button data-testid="go">Go</button></div>');
    const btn = document.querySelector('button');
    const bundle = computeSelectorBundle(btn);
    // Simulate DOM drift: the test id changed, but text/structure remain.
    btn.removeAttribute('data-testid');
    const result = resolveSelectorBundle(bundle, document);
    expect(result?.element).toBe(btn);
    expect(result?.candidate.type).not.toBe('testid');
  });

  it('returns null when nothing matches', () => {
    setBody('<button data-testid="go">Go</button>');
    const bundle = computeSelectorBundle(document.querySelector('button'));
    document.body.innerHTML = '<p>different page</p>';
    expect(resolveSelectorBundle(bundle, document)).toBe(null);
  });

  it('survives a full re-render that keeps role + name', () => {
    setBody('<header><button>Sign out</button></header>');
    const bundle = computeSelectorBundle(document.querySelector('button'));
    // Re-render: different wrapper/structure, same accessible button.
    setBody('<nav><div class="x"><button>Sign out</button></div></nav>');
    const result = resolveSelectorBundle(bundle, document);
    expect(result?.element).toBe(document.querySelector('button'));
    expect(result?.candidate.type).toBe('role+name');
  });
});
