// Content script — runs in the page. Owns everything that needs the live DOM:
// perceiving interactive elements, freezing a chosen element into a step, and
// replaying frozen steps. The index->element map stays here (elements can't
// cross the messaging boundary); only JSON (dom text, frozen steps) crosses.
//
// Network (LLM) and the skill store live in the side panel / service worker,
// not here, to avoid page CSP/CORS constraints.

import { serializeInteractive, serializeForm } from '../core/dom-serializer.js';
import { SkillRecorder } from '../core/recorder.js';
import { replayStep, replaySkill } from '../core/replay-engine.js';
import { computeSelectorBundle } from '../core/selector-engine.js';
import { applyFill } from '../core/form-fill.js';
import { MSG, sendRuntime } from '../shared/messages.js';

// The map from the most recent PERCEIVE, so EXECUTE_FREEZE can resolve an index.
let lastMap = new Map();
// The map from the most recent SERIALIZE_FORM, so APPLY_FILL can resolve fields.
let lastFormMap = new Map();

// Host actions during replay are delegated to the service worker.
const host = {
  navigate: (url) => { window.location.assign(url); },
  openTab: (url) => sendRuntime({ type: MSG.HOST_ACTION, action: 'openTab', url }),
  closeTab: () => sendRuntime({ type: MSG.HOST_ACTION, action: 'closeTab' }),
  switchTab: (value) => sendRuntime({ type: MSG.HOST_ACTION, action: 'switchTab', value }),
};

const recordFor = {
  click: (rec, el) => rec.recordClick(el),
  input: (rec, el, value) => rec.recordInput(el, value),
  select: (rec, el, value) => rec.recordSelect(el, value),
  scroll: (rec, el) => rec.recordScroll(el),
};

async function handlePerceive() {
  const { text, map, count } = serializeInteractive(document);
  lastMap = map;
  return { text, count, url: window.location.href };
}

async function handleExecuteFreeze({ action, index, value }) {
  const el = lastMap.get(index);
  if (!el) return { ok: false, error: `no element at index ${index}` };
  if (!el.isConnected) return { ok: false, error: `element at index ${index} left the DOM since perceive` };
  const recorder = new SkillRecorder();
  const make = recordFor[action];
  if (!make) return { ok: false, error: `unsupported action ${action}` };
  const step = make(recorder, el, value);
  try {
    await replayStep(step, { root: document, host });
    return { ok: true, step };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function handleReplaySkill({ skill, params }) {
  return replaySkill(skill, { root: document, host, params });
}

// Form-fill: perceive the form (keep the map here), and apply a plan later.
async function handleSerializeForm() {
  const { fields, map } = serializeForm(document);
  lastFormMap = map;
  return { fields, url: window.location.href };
}

async function handleApplyFill({ plan }) {
  return applyFill(plan || [], lastFormMap);
}

// Execute a single (possibly healed) step — used by the side panel's
// heal-aware run loop.
async function handleExecuteStep({ step, params }) {
  try {
    const r = await replayStep(step, { root: document, host, params });
    return { ok: true, candidateUsed: r.candidateUsed };
  } catch (err) {
    return { ok: false, error: err.message, reason: err.reason || 'error' };
  }
}

// Compute a fresh SelectorBundle for an index from the last PERCEIVE, without
// executing anything — used during self-heal relocation.
async function handleFreezeIndex({ index }) {
  const el = lastMap.get(index);
  if (!el) return { ok: false, error: `no element at index ${index}` };
  if (!el.isConnected) return { ok: false, error: `element at index ${index} left the DOM since perceive` };
  try {
    return { ok: true, bundle: computeSelectorBundle(el) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== 'string' || !message.type.startsWith('javis.')) return undefined;

  (async () => {
    try {
      switch (message.type) {
        case MSG.PING: return sendResponse({ ok: true });
        case MSG.PERCEIVE: return sendResponse(await handlePerceive());
        case MSG.EXECUTE_FREEZE: return sendResponse(await handleExecuteFreeze(message));
        case MSG.EXECUTE_STEP: return sendResponse(await handleExecuteStep(message));
        case MSG.FREEZE_INDEX: return sendResponse(await handleFreezeIndex(message));
        case MSG.REPLAY_SKILL: return sendResponse(await handleReplaySkill(message));
        case MSG.SERIALIZE_FORM: return sendResponse(await handleSerializeForm());
        case MSG.APPLY_FILL: return sendResponse(await handleApplyFill(message));
        default: return sendResponse({ ok: false, error: `unknown message ${message.type}` });
      }
    } catch (err) {
      return sendResponse({ ok: false, error: err.message });
    }
  })();

  return true; // keep the channel open for the async response
});

console.debug('[Javis] content script ready');
