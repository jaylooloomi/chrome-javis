import { describe, it, expect } from 'vitest';
import {
  buildChatRequest,
  parseChatResponse,
  chat,
  chatJSON,
  testConnection,
  LLMError,
} from '../src/core/llm-client.js';

const cfg = { baseURL: 'http://localhost:11434/v1', model: 'qwen3:14b', apiKey: 'secret' };

// A fake fetch that returns a canned OpenAI-compatible response.
function fakeFetch(responseBody, { ok = true, status = 200 } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return {
      ok,
      status,
      statusText: 'Err',
      json: async () => responseBody,
    };
  };
  fn.calls = calls;
  return fn;
}

const chatReply = (content) => ({ choices: [{ message: { role: 'assistant', content } }] });

describe('buildChatRequest', () => {
  it('targets the chat/completions path and sets bearer auth', () => {
    const { url, init } = buildChatRequest([{ role: 'user', content: 'hi' }], cfg);
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer secret');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('qwen3:14b');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('omits Authorization when no apiKey (local Ollama)', () => {
    const { init } = buildChatRequest([{ role: 'user', content: 'hi' }], { baseURL: 'http://localhost:11434/v1', model: 'm' });
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('accepts a full chat/completions baseURL without doubling the path', () => {
    const { url } = buildChatRequest([{ role: 'user', content: 'x' }], { ...cfg, baseURL: 'https://api.x.com/v1/chat/completions' });
    expect(url).toBe('https://api.x.com/v1/chat/completions');
  });

  it('requests json response_format when asked', () => {
    const { init } = buildChatRequest([{ role: 'user', content: 'x' }], { ...cfg, responseFormat: 'json' });
    expect(JSON.parse(init.body).response_format).toEqual({ type: 'json_object' });
  });

  it('throws on missing model or baseURL or empty messages', () => {
    expect(() => buildChatRequest([{ role: 'user', content: 'x' }], { baseURL: 'http://x' })).toThrow(LLMError);
    expect(() => buildChatRequest([{ role: 'user', content: 'x' }], { model: 'm' })).toThrow(LLMError);
    expect(() => buildChatRequest([], cfg)).toThrow(LLMError);
  });
});

describe('parseChatResponse', () => {
  it('extracts assistant content', () => {
    expect(parseChatResponse(chatReply('hello'))).toBe('hello');
  });
  it('throws on malformed response', () => {
    expect(() => parseChatResponse({ choices: [] })).toThrow(LLMError);
  });
});

describe('chat', () => {
  it('returns the assistant text', async () => {
    const f = fakeFetch(chatReply('the answer'));
    const out = await chat([{ role: 'user', content: 'q' }], cfg, f);
    expect(out).toBe('the answer');
    expect(f.calls).toHaveLength(1);
  });

  it('throws LLMError with status on HTTP error', async () => {
    const f = fakeFetch({ error: { message: 'bad key' } }, { ok: false, status: 401 });
    await expect(chat([{ role: 'user', content: 'q' }], cfg, f)).rejects.toMatchObject({ reason: 'http', status: 401 });
  });

  it('wraps network errors', async () => {
    const f = async () => { throw new Error('ECONNREFUSED'); };
    await expect(chat([{ role: 'user', content: 'q' }], cfg, f)).rejects.toMatchObject({ reason: 'transport' });
  });
});

describe('chatJSON', () => {
  it('parses a JSON object, stripping code fences', async () => {
    const f = fakeFetch(chatReply('```json\n{"action":"click","index":3}\n```'));
    const out = await chatJSON([{ role: 'user', content: 'q' }], cfg, f);
    expect(out).toEqual({ action: 'click', index: 3 });
  });

  it('throws format error on non-JSON', async () => {
    const f = fakeFetch(chatReply('not json'));
    await expect(chatJSON([{ role: 'user', content: 'q' }], cfg, f)).rejects.toMatchObject({ reason: 'format' });
  });
});

describe('testConnection', () => {
  it('reports ok with the reply', async () => {
    const f = fakeFetch(chatReply('ok'));
    expect(await testConnection(cfg, f)).toEqual({ ok: true, reply: 'ok' });
  });
  it('reports failure without throwing', async () => {
    const f = fakeFetch({ error: { message: 'down' } }, { ok: false, status: 500 });
    const res = await testConnection(cfg, f);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('http');
  });
});
