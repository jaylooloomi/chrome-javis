// Model-agnostic LLM client.
//
// Talks to any OpenAI-compatible /chat/completions endpoint. This decouples the
// product from any single provider and resolves the Ollama-vs-cloud tension:
// the user supplies { baseURL, model, apiKey } and points it at local Ollama
// (http://localhost:11434/v1), a cloud key, or the page-agent demo endpoint
// during development.
//
// Kept pure and fetch-injectable so request building and response parsing are
// unit-testable without a network.

export const DEFAULT_ENDPOINT = Object.freeze({
  baseURL: 'http://localhost:11434/v1',
  model: 'minimax-m2.5:cloud',
  apiKey: '',
});

export class LLMError extends Error {
  constructor(message, { status, reason } = {}) {
    super(message);
    this.name = 'LLMError';
    this.status = status;
    this.reason = reason;
  }
}

/** Normalize a baseURL and join the chat completions path. */
function chatCompletionsUrl(baseURL) {
  const base = String(baseURL || '').replace(/\/+$/, '');
  if (!base) throw new LLMError('LLM config missing baseURL', { reason: 'config' });
  // Allow callers to pass either ".../v1" or a full ".../chat/completions".
  if (/\/chat\/completions$/.test(base)) return base;
  return `${base}/chat/completions`;
}

/**
 * Build the HTTP request for a chat completion. Returns { url, init } so it can
 * be inspected in tests or passed to any fetch implementation.
 */
export function buildChatRequest(messages, config = {}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new LLMError('messages must be a non-empty array', { reason: 'config' });
  }
  const { baseURL, model, apiKey, temperature = 0.2, maxTokens, responseFormat } = config;
  if (!model) throw new LLMError('LLM config missing model', { reason: 'config' });

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const body = { model, messages, temperature };
  if (maxTokens) body.max_tokens = maxTokens;
  if (responseFormat === 'json') body.response_format = { type: 'json_object' };

  return {
    url: chatCompletionsUrl(baseURL),
    init: { method: 'POST', headers, body: JSON.stringify(body) },
  };
}

/** Extract the assistant message text from an OpenAI-compatible response. */
export function parseChatResponse(json) {
  const choice = json?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content !== 'string') {
    throw new LLMError('LLM response missing choices[0].message.content', { reason: 'format' });
  }
  return content;
}

/**
 * Perform a chat completion. `fetchImpl` defaults to global fetch; inject a fake
 * in tests. Throws LLMError on transport/HTTP/format problems.
 */
export async function chat(messages, config = {}, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new LLMError('no fetch implementation available', { reason: 'transport' });
  }
  const { url, init } = buildChatRequest(messages, config);

  let res;
  try {
    res = await fetchImpl(url, init);
  } catch (err) {
    throw new LLMError(`network error contacting LLM: ${err.message}`, { reason: 'transport' });
  }

  if (!res.ok) {
    let detail = '';
    try {
      const errJson = await res.json();
      detail = errJson?.error?.message || JSON.stringify(errJson);
    } catch {
      detail = res.statusText;
    }
    throw new LLMError(`LLM HTTP ${res.status}: ${detail}`, { status: res.status, reason: 'http' });
  }

  const json = await res.json();
  return parseChatResponse(json);
}

/**
 * Convenience: ask for a JSON object back and parse it. Strips ```json fences
 * that some models emit despite response_format.
 */
export async function chatJSON(messages, config = {}, fetchImpl = globalThis.fetch) {
  const text = await chat(messages, { ...config, responseFormat: 'json' }, fetchImpl);
  const cleaned = text.replace(/```json\s*|\s*```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new LLMError(`LLM did not return valid JSON: ${err.message}`, { reason: 'format' });
  }
}

/** Quick connectivity probe used by the settings page "test connection" button. */
export async function testConnection(config = {}, fetchImpl = globalThis.fetch) {
  try {
    const reply = await chat(
      [{ role: 'user', content: 'Reply with the single word: ok' }],
      { ...config, maxTokens: 8 },
      fetchImpl,
    );
    return { ok: true, reply: reply.trim() };
  } catch (err) {
    return { ok: false, error: err.message, reason: err.reason };
  }
}
