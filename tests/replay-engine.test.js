import { describe, it, expect, beforeEach } from 'vitest';
import {
  interpolate,
  replayStep,
  replaySkill,
  waitForCondition,
  ReplayError,
} from '../src/core/replay-engine.js';
import { computeSelectorBundle } from '../src/core/selector-engine.js';

const cssBundle = (sel) => ({ candidates: [{ type: 'css', value: sel, score: 40 }] });
const setBody = (html) => { document.body.innerHTML = html; };

beforeEach(() => { document.body.innerHTML = ''; });

describe('interpolate', () => {
  it('substitutes {{param}} placeholders', () => {
    expect(interpolate('hi {{name}}!', { name: 'bob' })).toBe('hi bob!');
  });
  it('treats missing params as empty', () => {
    expect(interpolate('a{{x}}b', {})).toBe('ab');
  });
  it('passes through non-strings', () => {
    expect(interpolate(42, {})).toBe(42);
  });
});

describe('replayStep — DOM actions', () => {
  it('clicks the element resolved from a bundle', async () => {
    setBody('<button id="b">Go</button>');
    let clicks = 0;
    document.querySelector('#b').addEventListener('click', () => { clicks += 1; });
    const bundle = computeSelectorBundle(document.querySelector('#b'));
    const r = await replayStep({ action: 'click', selector: bundle }, {});
    expect(clicks).toBe(1);
    expect(r.ok).toBe(true);
    expect(r.candidateUsed).toBeTruthy();
  });

  it('inputs an interpolated value and fires input + change', async () => {
    setBody('<input id="t">');
    const el = document.querySelector('#t');
    let inputs = 0; let changes = 0;
    el.addEventListener('input', () => { inputs += 1; });
    el.addEventListener('change', () => { changes += 1; });
    await replayStep({ action: 'input', selector: cssBundle('#t'), value: 'hello {{name}}' }, { params: { name: 'bob' } });
    expect(el.value).toBe('hello bob');
    expect(inputs).toBe(1);
    expect(changes).toBe(1);
  });

  it('selects an option by visible text', async () => {
    setBody('<select id="s"><option value="a">Apple</option><option value="b">Banana</option></select>');
    const el = document.querySelector('#s');
    let changes = 0;
    el.addEventListener('change', () => { changes += 1; });
    await replayStep({ action: 'select', selector: cssBundle('#s'), value: 'Banana' }, {});
    expect(el.value).toBe('b');
    expect(changes).toBe(1);
  });

  it('throws selector-not-found when the element is gone', async () => {
    setBody('<div></div>');
    await expect(replayStep({ action: 'click', selector: cssBundle('#missing') }, {}))
      .rejects.toMatchObject({ reason: 'selector-not-found' });
  });
});

describe('replayStep — host actions', () => {
  it('delegates navigate to the host with an interpolated url', async () => {
    let navigated = null;
    const host = { navigate: (url) => { navigated = url; } };
    await replayStep({ action: 'navigate', value: 'https://e.com/{{q}}' }, { host, params: { q: 'abc' } });
    expect(navigated).toBe('https://e.com/abc');
  });

  it('throws no-host when the host method is missing', async () => {
    await expect(replayStep({ action: 'openTab', value: 'https://e.com' }, { host: {} }))
      .rejects.toMatchObject({ reason: 'no-host' });
  });
});

describe('waitForCondition', () => {
  it('resolves once an element appears', async () => {
    setTimeout(() => { document.body.insertAdjacentHTML('beforeend', '<div id="x"></div>'); }, 15);
    await waitForCondition({ type: 'element', selector: cssBundle('#x'), timeout: 1000 }, { pollInterval: 5 });
    expect(document.getElementById('x')).toBeTruthy();
  });

  it('resolves once an element is gone', async () => {
    setBody('<div id="x"></div>');
    setTimeout(() => { document.getElementById('x').remove(); }, 15);
    await waitForCondition({ type: 'gone', selector: cssBundle('#x'), timeout: 1000 }, { pollInterval: 5 });
    expect(document.getElementById('x')).toBe(null);
  });

  it('times out with reason wait-timeout', async () => {
    await expect(
      waitForCondition({ type: 'element', selector: cssBundle('#nope'), timeout: 30 }, { pollInterval: 5 }),
    ).rejects.toBeInstanceOf(ReplayError);
  });
});

describe('replaySkill', () => {
  it('runs every step and reports progress', async () => {
    setBody('<button id="b">Go</button><input id="t">');
    const seen = [];
    const r = await replaySkill(
      {
        steps: [
          { action: 'click', selector: cssBundle('#b') },
          { action: 'input', selector: cssBundle('#t'), value: '{{q}}' },
        ],
        params: [{ name: 'q', default: 'def' }],
      },
      { params: { q: 'xyz' }, onStep: (e) => seen.push(e.stepIndex) },
    );
    expect(r.ok).toBe(true);
    expect(r.completed).toBe(2);
    expect(seen).toEqual([0, 1]);
    expect(document.querySelector('#t').value).toBe('xyz');
  });

  it('applies skill param defaults when caller omits them', async () => {
    setBody('<input id="t">');
    await replaySkill(
      { steps: [{ action: 'input', selector: cssBundle('#t'), value: '{{q}}' }], params: [{ name: 'q', default: 'DEFVAL' }] },
      {},
    );
    expect(document.querySelector('#t').value).toBe('DEFVAL');
  });

  it('stops at the first failing step and reports it', async () => {
    setBody('<button id="b">Go</button>');
    const errors = [];
    const r = await replaySkill(
      {
        steps: [
          { action: 'click', selector: cssBundle('#b') },
          { action: 'click', selector: cssBundle('#missing') },
          { action: 'click', selector: cssBundle('#b') },
        ],
      },
      { onError: (e) => errors.push(e.reason) },
    );
    expect(r.ok).toBe(false);
    expect(r.failedStep).toBe(1);
    expect(r.reason).toBe('selector-not-found');
    expect(r.completed).toBe(1);
    expect(errors).toEqual(['selector-not-found']);
  });
});
