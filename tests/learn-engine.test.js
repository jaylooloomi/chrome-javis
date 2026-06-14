import { describe, it, expect, beforeEach } from 'vitest';
import { learnTask, parseAgentAction, buildAgentMessages } from '../src/core/learn-engine.js';
import { replaySkill } from '../src/core/replay-engine.js';

const setBody = (html) => { document.body.innerHTML = html; };
beforeEach(() => { document.body.innerHTML = ''; });

// A scripted "LLM": returns queued actions regardless of input.
function scriptedLLM(actions) {
  let i = 0;
  return async () => {
    if (i >= actions.length) return { action: 'done', reason: 'script exhausted' };
    return actions[i++];
  };
}

describe('parseAgentAction', () => {
  it('accepts a valid click', () => {
    expect(parseAgentAction({ action: 'click', index: 2 }).index).toBe(2);
  });
  it('requires index for dom actions', () => {
    expect(() => parseAgentAction({ action: 'click' })).toThrow();
  });
  it('requires value for input and url for navigate', () => {
    expect(() => parseAgentAction({ action: 'input', index: 0 })).toThrow();
    expect(() => parseAgentAction({ action: 'navigate' })).toThrow();
  });
  it('rejects unknown actions', () => {
    expect(() => parseAgentAction({ action: 'teleport' })).toThrow();
  });
});

describe('buildAgentMessages', () => {
  it('includes the task, dom text and history', () => {
    const msgs = buildAgentMessages('do X', '[0]<button>Go</button>', { url: 'https://e.com', history: ['click [0]'] });
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].content).toContain('do X');
    expect(msgs[1].content).toContain('[0]<button>Go</button>');
    expect(msgs[1].content).toContain('click [0]');
  });
});

describe('learnTask (scripted LLM)', () => {
  it('drives a search task and freezes a replayable skill', async () => {
    setBody('<input id="q" name="q"><button data-testid="go">Search</button><div id="r"></div>');
    const input = document.querySelector('#q');
    document.querySelector('button').addEventListener('click', () => {
      document.querySelector('#r').textContent = `searched:${input.value}`;
    });

    // Interactive order: input=[0], button=[1].
    const llm = scriptedLLM([
      { action: 'input', index: 0, value: 'cats' },
      { action: 'click', index: 1 },
      { action: 'done', reason: 'results shown' },
    ]);

    const result = await learnTask('search for cats', { root: document, llm });

    expect(result.ok).toBe(true);
    expect(document.querySelector('#r').textContent).toBe('searched:cats');
    expect(result.skill.steps.map((s) => s.action)).toEqual(['input', 'click']);

    // The frozen skill replays on a fresh copy of the page, with a new value.
    setBody('<input id="q" name="q"><button data-testid="go">Search</button><div id="r"></div>');
    const input2 = document.querySelector('#q');
    document.querySelector('button').addEventListener('click', () => {
      document.querySelector('#r').textContent = `searched:${input2.value}`;
    });
    // make the typed value a param for reuse
    result.skill.steps[0].value = '{{q}}';
    result.skill.params = [{ name: 'q', default: 'cats' }];
    const replay = await replaySkill(result.skill, { params: { q: 'dogs' } });
    expect(replay.ok).toBe(true);
    expect(document.querySelector('#r').textContent).toBe('searched:dogs');
  });

  it('retries when the model picks a non-existent index, without freezing it', async () => {
    setBody('<button data-testid="go">Go</button>');
    let clicks = 0;
    document.querySelector('button').addEventListener('click', () => { clicks += 1; });
    const llm = scriptedLLM([
      { action: 'click', index: 99 }, // bad index -> skipped, not frozen
      { action: 'click', index: 0 }, // valid
      { action: 'done' },
    ]);
    const result = await learnTask('click go', { root: document, llm });
    expect(result.ok).toBe(true);
    expect(clicks).toBe(1);
    expect(result.skill.steps).toHaveLength(1); // only the valid click was frozen
  });

  it('stops at maxSteps when the model never finishes', async () => {
    setBody('<button>Go</button>');
    const llm = scriptedLLM(Array.from({ length: 5 }, () => ({ action: 'click', index: 0 })));
    const result = await learnTask('loop', { root: document, llm, maxSteps: 3 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('max-steps');
  });

  it('reports bad-action when the model returns garbage', async () => {
    setBody('<button>Go</button>');
    const llm = async () => ({ action: 'nonsense' });
    const result = await learnTask('x', { root: document, llm });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('bad-action');
  });
});
