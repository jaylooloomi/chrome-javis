// LLM endpoint configuration, persisted in chrome.storage.local.
//
// NOTE (P8): the apiKey is stored in local storage as-is for now. Encrypting it
// at rest with crypto-utils is a planned hardening step before Web Store
// release. It is kept in `local` (never `sync`) so it does not leave the device.

import { DEFAULT_ENDPOINT } from '../core/llm-client.js';

export const LLM_KEY = 'javis.llm';

export async function loadLLMConfig() {
  const r = await chrome.storage.local.get(LLM_KEY);
  return { ...DEFAULT_ENDPOINT, ...(r[LLM_KEY] || {}) };
}

export async function saveLLMConfig(config) {
  const clean = {
    baseURL: String(config.baseURL || '').trim(),
    model: String(config.model || '').trim(),
    apiKey: String(config.apiKey || ''),
  };
  await chrome.storage.local.set({ [LLM_KEY]: clean });
  return clean;
}
