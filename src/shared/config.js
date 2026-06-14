// LLM endpoint configuration, persisted in chrome.storage.local.
//
// The apiKey is encrypted at rest (see crypto-utils.js for the honest caveat)
// and stored under `apiKeyEnc`; it is never written to chrome.storage.sync, so
// it does not leave the device.

import { DEFAULT_ENDPOINT } from '../core/llm-client.js';
import { encryptString, decryptString } from './crypto-utils.js';

export const LLM_KEY = 'javis.llm';
export const FILL_PROVIDER_KEY = 'javis.fillProvider';

/** Form-fill model preference: 'auto' (Nano then endpoint) or 'endpoint'. */
export async function loadFillProvider() {
  const r = await chrome.storage.local.get(FILL_PROVIDER_KEY);
  return r[FILL_PROVIDER_KEY] || 'auto';
}

export async function saveFillProvider(value) {
  await chrome.storage.local.set({ [FILL_PROVIDER_KEY]: value === 'endpoint' ? 'endpoint' : 'auto' });
}

export async function loadLLMConfig() {
  const r = await chrome.storage.local.get(LLM_KEY);
  const stored = r[LLM_KEY] || {};
  // Back-compat: an older build may have stored a plaintext apiKey.
  const apiKey = stored.apiKeyEnc ? await decryptString(stored.apiKeyEnc) : (stored.apiKey || '');
  return {
    baseURL: stored.baseURL || DEFAULT_ENDPOINT.baseURL,
    model: stored.model || DEFAULT_ENDPOINT.model,
    apiKey,
  };
}

export async function saveLLMConfig(config) {
  const clean = {
    baseURL: String(config.baseURL || '').trim(),
    model: String(config.model || '').trim(),
    apiKey: String(config.apiKey || ''),
  };
  await chrome.storage.local.set({
    [LLM_KEY]: {
      baseURL: clean.baseURL,
      model: clean.model,
      apiKeyEnc: await encryptString(clean.apiKey),
    },
  });
  return clean;
}
