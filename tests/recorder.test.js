import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRecorder } from '../src/core/recorder.js';
import { resolveSelectorBundle, computeSelectorBundle } from '../src/core/selector-engine.js';
import { replaySkill } from '../src/core/replay-engine.js';

const setBody = (html) => { document.body.innerHTML = html; };

beforeEach(() => { document.body.innerHTML = ''; });

describe('SkillRecorder', () => {
  it('freezes a click into a bundle that resolves back to the element', () => {
    setBody('<div id="app"><button data-testid="go">Go</button></div>');
    const btn = document.querySelector('button');
    const rec = new SkillRecorder();
    const step = rec.recordClick(btn);
    expect(step.action).toBe('click');
    expect(resolveSelectorBundle(step.selector, document)?.element).toBe(btn);
  });

  it('records an input with its value', () => {
    setBody('<input id="t">');
    const rec = new SkillRecorder();
    const step = rec.recordInput(document.querySelector('#t'), 'hello');
    expect(step.value).toBe('hello');
    expect(step.selector.candidates.length).toBeGreaterThan(0);
  });

  it('records navigate and captures startUrl', () => {
    const rec = new SkillRecorder();
    rec.recordNavigate('https://example.com/');
    expect(rec.startUrl).toBe('https://example.com/');
    expect(rec.steps[0]).toMatchObject({ action: 'navigate', value: 'https://example.com/' });
  });

  it('records host actions without a selector', () => {
    const rec = new SkillRecorder();
    const step = rec.recordStep({ action: 'openTab', url: 'https://e.com' });
    expect(step.selector).toBeUndefined();
    expect(step.value).toBe('https://e.com');
  });

  it('throws when a DOM action lacks an element', () => {
    const rec = new SkillRecorder();
    expect(() => rec.recordStep({ action: 'click' })).toThrow();
  });

  it('parameterizes literal values into reusable params', () => {
    setBody('<input id="q">');
    const rec = new SkillRecorder();
    rec.recordInput(document.querySelector('#q'), 'shoes');
    const applied = rec.parameterize([{ value: 'shoes', name: 'query', label: 'Search term' }]);
    expect(applied).toEqual([{ name: 'query', label: 'Search term', default: 'shoes' }]);
    expect(rec.steps[0].value).toBe('{{query}}');
    expect(rec.toSkill().params).toEqual([{ name: 'query', label: 'Search term', default: 'shoes' }]);
  });

  it('emits a skill object of the expected shape', () => {
    setBody('<button>Go</button>');
    const rec = new SkillRecorder();
    rec.recordNavigate('https://e.com/');
    rec.recordClick(document.querySelector('button'));
    const skill = rec.toSkill({ name: 'My skill', description: 'does a thing' });
    expect(skill.name).toBe('My skill');
    expect(skill.startUrl).toBe('https://e.com/');
    expect(skill.steps).toHaveLength(2);
  });
});

describe('record -> replay round trip (P1 + P2 + P5)', () => {
  it('a recorded sequence replays and reproduces its effects', async () => {
    setBody('<form id="f"><input id="q" name="q"><button data-testid="submit">Search</button></form><div id="log"></div>');
    const input = document.querySelector('#q');
    const button = document.querySelector('button');
    let submitted = '';
    button.addEventListener('click', () => { submitted = input.value; });

    // Record a user typing + clicking submit.
    const rec = new SkillRecorder();
    rec.recordInput(input, 'cat food');
    rec.recordClick(button);
    rec.parameterize([{ value: 'cat food', name: 'query' }]);
    const skill = rec.toSkill({ name: 'Search' });

    // Reset state, then replay with a different param value.
    input.value = '';
    submitted = '';
    const result = await replaySkill(skill, { params: { query: 'dog toys' } });

    expect(result.ok).toBe(true);
    expect(input.value).toBe('dog toys');
    expect(submitted).toBe('dog toys');
  });

  it('replay still finds elements after a DOM re-render (drift)', async () => {
    setBody('<div class="v1"><button data-testid="go">Go</button></div>');
    let clicks = 0;
    const attach = () => document.querySelector('button').addEventListener('click', () => { clicks += 1; });
    attach();

    const rec = new SkillRecorder();
    rec.recordClick(document.querySelector('button'));
    const skill = rec.toSkill();

    // Re-render with different wrapper but the testid survives.
    setBody('<section class="v2"><div><button data-testid="go">Go</button></div></section>');
    attach();

    const result = await replaySkill(skill, {});
    expect(result.ok).toBe(true);
    expect(clicks).toBe(1);
  });
});
