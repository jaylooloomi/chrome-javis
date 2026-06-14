// Gemini Nano provider — Chrome's built-in on-device model via the Prompt API
// (`LanguageModel`). Exposes a chatJSON-compatible function so callers can swap
// it for the OpenAI-compatible client transparently. On-device = free, private,
// offline — the right default for form-fill.
//
// The `LanguageModel` global only exists in Chrome; it is injected here (default
// globalThis.LanguageModel) so this module is unit-testable with a fake.

import { chatJSON } from './llm-client.js';

export class NanoError extends Error {
  constructor(message, reason) {
    super(message);
    this.name = 'NanoError';
    this.reason = reason;
  }
}

function getLM(LM) {
  return LM ?? globalThis.LanguageModel;
}

/** 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'no-api'. */
export async function nanoAvailability(LM) {
  const lm = getLM(LM);
  if (!lm || typeof lm.availability !== 'function') return 'no-api';
  try {
    return await lm.availability();
  } catch {
    return 'unavailable';
  }
}

function stripFences(text) {
  return String(text).replace(/```json\s*|\s*```/g, '').trim();
}

/** Split OpenAI-style messages into a system prompt + a single user prompt. */
function splitMessages(messages) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const prompt = messages.filter((m) => m.role !== 'system').map((m) => m.content).join('\n\n');
  return { system, prompt };
}

/** Trigger / await the on-device model download, reporting progress 0..1. */
export async function ensureNanoDownloaded(onProgress, LM) {
  const lm = getLM(LM);
  if (!lm) throw new NanoError('Prompt API (LanguageModel) not available', 'no-api');
  const session = await lm.create({
    monitor(m) {
      m.addEventListener?.('downloadprogress', (e) => onProgress?.(e.loaded));
    },
  });
  session.destroy?.();
  return true;
}

/** One-shot prompt against Nano. Returns the raw text. */
export async function nanoChat(messages, { responseConstraint, signal } = {}, LM) {
  const lm = getLM(LM);
  if (!lm || typeof lm.create !== 'function') {
    throw new NanoError('Prompt API (LanguageModel) not available', 'no-api');
  }
  const { system, prompt } = splitMessages(messages);
  const session = await lm.create(system ? { initialPrompts: [{ role: 'system', content: system }] } : {});
  try {
    const opts = {};
    if (responseConstraint) opts.responseConstraint = responseConstraint;
    if (signal) opts.signal = signal;
    return await session.prompt(prompt, Object.keys(opts).length ? opts : undefined);
  } finally {
    session.destroy?.();
  }
}

/** chatJSON-compatible: returns a parsed JSON object from Nano. */
export async function nanoChatJSON(messages, config = {}, LM) {
  const text = await nanoChat(messages, { responseConstraint: config.responseConstraint, signal: config.signal }, LM);
  try {
    return JSON.parse(stripFences(text));
  } catch (err) {
    throw new NanoError(`Nano did not return valid JSON: ${err.message}`, 'format');
  }
}

/**
 * Resolve a chatJSON-compatible function honoring the user's provider choice.
 * Nano-first with endpoint fallback: if Nano is requested (or 'auto') and
 * actually 'available', use it; otherwise fall back to the configured
 * OpenAI-compatible endpoint.
 *
 * @returns {Promise<{ fn: Function, usingNano: boolean, availability: string }>}
 */
export async function resolveChatJSON({ provider = 'auto', llmConfig = {}, fetchImpl, LM } = {}) {
  const availability = await nanoAvailability(LM);
  const wantNano = provider === 'chrome-nano' || provider === 'auto';
  const usingNano = wantNano && availability === 'available';

  if (usingNano) {
    return {
      usingNano: true,
      availability,
      fn: (messages, perCall = {}) => nanoChatJSON(messages, perCall, LM),
    };
  }
  return {
    usingNano: false,
    availability,
    fn: (messages, perCall = {}) => chatJSON(messages, { ...llmConfig, ...perCall }, fetchImpl),
  };
}
