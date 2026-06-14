import { describe, it, expect } from 'vitest';
import {
  nanoAvailability,
  nanoChat,
  nanoChatJSON,
  resolveChatJSON,
  ensureNanoDownloaded,
  NanoError,
} from '../src/core/nano-client.js';

// A fake LanguageModel implementing the Prompt API surface we use.
function fakeLM({ availability = 'available', reply = '{"ok":true}', capture } = {}) {
  return {
    async availability() { return availability; },
    async create(opts) {
      capture?.create?.(opts);
      return {
        async prompt(text, promptOpts) {
          capture?.prompt?.({ text, promptOpts });
          return reply;
        },
        destroy() { capture?.destroy?.(); },
      };
    },
  };
}

describe('nanoAvailability', () => {
  it('returns no-api when LanguageModel is absent', async () => {
    expect(await nanoAvailability(undefined)).toBe('no-api');
  });
  it('passes through the availability state', async () => {
    expect(await nanoAvailability(fakeLM({ availability: 'downloadable' }))).toBe('downloadable');
  });
});

describe('nanoChat', () => {
  it('creates a session with the system prompt and forwards the user prompt + constraint', async () => {
    const cap = {};
    const calls = { create: (o) => { cap.create = o; }, prompt: (p) => { cap.prompt = p; }, destroy: () => { cap.destroyed = true; } };
    const lm = fakeLM({ reply: 'hi', capture: calls });
    const schema = { type: 'object' };
    const out = await nanoChat(
      [{ role: 'system', content: 'be brief' }, { role: 'user', content: 'hello' }],
      { responseConstraint: schema },
      lm,
    );
    expect(out).toBe('hi');
    expect(cap.create.initialPrompts).toEqual([{ role: 'system', content: 'be brief' }]);
    expect(cap.prompt.text).toBe('hello');
    expect(cap.prompt.promptOpts.responseConstraint).toBe(schema);
    expect(cap.destroyed).toBe(true);
  });

  it('throws no-api when LanguageModel is missing', async () => {
    await expect(nanoChat([{ role: 'user', content: 'x' }], {}, undefined)).rejects.toMatchObject({ reason: 'no-api' });
  });
});

describe('nanoChatJSON', () => {
  it('parses JSON, stripping code fences', async () => {
    const lm = fakeLM({ reply: '```json\n{"action":"click","index":2}\n```' });
    expect(await nanoChatJSON([{ role: 'user', content: 'x' }], {}, lm)).toEqual({ action: 'click', index: 2 });
  });
  it('throws format error on non-JSON', async () => {
    const lm = fakeLM({ reply: 'not json' });
    await expect(nanoChatJSON([{ role: 'user', content: 'x' }], {}, lm)).rejects.toMatchObject({ reason: 'format' });
  });
});

describe('ensureNanoDownloaded', () => {
  it('reports progress and resolves', async () => {
    const progress = [];
    const lm = {
      async create(opts) {
        opts.monitor({ addEventListener: (_e, cb) => cb({ loaded: 0.5 }) });
        return { destroy() {} };
      },
    };
    await ensureNanoDownloaded((p) => progress.push(p), lm);
    expect(progress).toEqual([0.5]);
  });
});

describe('resolveChatJSON (Nano-first, endpoint fallback)', () => {
  it('uses Nano when available', async () => {
    const lm = fakeLM({ availability: 'available', reply: '{"src":"nano"}' });
    const { fn, usingNano } = await resolveChatJSON({ provider: 'chrome-nano', LM: lm });
    expect(usingNano).toBe(true);
    expect(await fn([{ role: 'user', content: 'x' }])).toEqual({ src: 'nano' });
  });

  it('falls back to the endpoint when Nano is not available', async () => {
    const lm = fakeLM({ availability: 'downloadable' });
    const fakeFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{"src":"endpoint"}' } }] }),
    });
    const { fn, usingNano } = await resolveChatJSON({
      provider: 'chrome-nano',
      llmConfig: { baseURL: 'http://localhost:11434/v1', model: 'm' },
      fetchImpl: fakeFetch,
      LM: lm,
    });
    expect(usingNano).toBe(false);
    expect(await fn([{ role: 'user', content: 'x' }])).toEqual({ src: 'endpoint' });
  });

  it('falls back when there is no Prompt API at all', async () => {
    const fakeFetch = async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"src":"endpoint"}' } }] }) });
    const { usingNano, availability } = await resolveChatJSON({
      provider: 'auto',
      llmConfig: { baseURL: 'http://x/v1', model: 'm' },
      fetchImpl: fakeFetch,
      LM: undefined,
    });
    expect(usingNano).toBe(false);
    expect(availability).toBe('no-api');
  });
});
