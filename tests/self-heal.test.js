import { describe, it, expect, beforeEach } from 'vitest';
import {
  replaySkillWithHeal,
  buildRelocateMessages,
  parseRelocateResponse,
  describeStepIntent,
} from '../src/core/self-heal.js';

const cssBundle = (sel) => ({ candidates: [{ type: 'css', value: sel, score: 40 }] });
const setBody = (html) => { document.body.innerHTML = html; };
beforeEach(() => { document.body.innerHTML = ''; });

describe('relocate prompt helpers', () => {
  it('describes a step intent from its richest candidates', () => {
    const step = { action: 'click', selector: { tag: 'button', candidates: [
      { type: 'role+name', value: { role: 'button', name: 'Sign in' }, score: 80 },
      { type: 'text', value: 'Sign in', score: 60 },
    ] } };
    const desc = describeStepIntent(step);
    expect(desc).toContain('action=click');
    expect(desc).toContain('Sign in');
    expect(desc).toContain('tag=button');
  });

  it('builds relocate messages with the dom text', () => {
    const msgs = buildRelocateMessages({ action: 'click', selector: cssBundle('#x') }, '[0]<button>Go</button>', { url: 'https://e.com' });
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].content).toContain('[0]<button>Go</button>');
  });

  it('parses relocate responses', () => {
    expect(parseRelocateResponse({ index: 3 })).toBe(3);
    expect(parseRelocateResponse({ found: false })).toBe(null);
    expect(parseRelocateResponse({})).toBe(null);
    expect(parseRelocateResponse('nope')).toBe(null);
  });
});

describe('replaySkillWithHeal', () => {
  it('runs normally with no heal when selectors resolve', async () => {
    setBody('<button id="b">Go</button>');
    let clicks = 0;
    document.querySelector('#b').addEventListener('click', () => { clicks += 1; });
    const r = await replaySkillWithHeal({ steps: [{ action: 'click', selector: cssBundle('#b') }] }, {});
    expect(r.ok).toBe(true);
    expect(r.healed).toBe(false);
    expect(clicks).toBe(1);
  });

  it('heals a broken selector via relocate and retries', async () => {
    setBody('<button id="real">Go</button>');
    let clicks = 0;
    document.querySelector('#real').addEventListener('click', () => { clicks += 1; });

    const reheals = [];
    const relocate = async ({ stepIndex }) => {
      expect(stepIndex).toBe(0);
      return cssBundle('#real'); // model found the moved element
    };
    const r = await replaySkillWithHeal(
      { steps: [{ action: 'click', selector: cssBundle('#gone') }] },
      { relocate, onReheal: (e) => reheals.push(e.stepIndex) },
    );

    expect(r.ok).toBe(true);
    expect(r.healed).toBe(true);
    expect(r.healedSteps[0].step.selector).toEqual(cssBundle('#real'));
    expect(clicks).toBe(1);
    expect(reheals).toEqual([0]);
  });

  it('fails with heal-failed when relocate returns null', async () => {
    setBody('<div></div>');
    const r = await replaySkillWithHeal(
      { steps: [{ action: 'click', selector: cssBundle('#gone') }] },
      { relocate: async () => null },
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('heal-failed');
  });

  it('fails with heal-retry-failed when the relocated bundle also misses', async () => {
    setBody('<div></div>');
    const r = await replaySkillWithHeal(
      { steps: [{ action: 'click', selector: cssBundle('#gone') }] },
      { relocate: async () => cssBundle('#also-gone') },
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('heal-retry-failed');
  });

  it('falls back to plain failure when no relocate is provided', async () => {
    setBody('<div></div>');
    const r = await replaySkillWithHeal({ steps: [{ action: 'click', selector: cssBundle('#gone') }] }, {});
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('selector-not-found');
  });

  it('heals only the broken step and completes the rest', async () => {
    setBody('<button id="a">A</button><button id="real">B</button>');
    let a = 0; let b = 0;
    document.querySelector('#a').addEventListener('click', () => { a += 1; });
    document.querySelector('#real').addEventListener('click', () => { b += 1; });
    const r = await replaySkillWithHeal(
      {
        steps: [
          { action: 'click', selector: cssBundle('#a') }, // fine
          { action: 'click', selector: cssBundle('#gone') }, // needs heal -> #real
        ],
      },
      { relocate: async () => cssBundle('#real') },
    );
    expect(r.ok).toBe(true);
    expect(r.healed).toBe(true);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(r.healedSteps).toHaveLength(1);
  });
});
