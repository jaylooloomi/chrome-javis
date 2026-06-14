// Content script — runs in the page. Owns the live DOM work: serializing the
// form's fillable fields and applying a confirmed fill plan. The index->element
// map stays here (elements can't cross the messaging boundary); only JSON
// (field schema, fill plan) crosses. Network (LLM) lives in the side panel.

import { serializeForm } from '../core/dom-serializer.js';
import { applyFill } from '../core/form-fill.js';
import { MSG } from '../shared/messages.js';

// The map from the most recent SERIALIZE_FORM, so APPLY_FILL can resolve fields,
// plus the URL it was captured on (to detect SPA navigation before applying).
let lastFormMap = new Map();
let lastFormUrl = null;

function handleSerializeForm() {
  const { fields, map } = serializeForm(document);
  lastFormMap = map;
  lastFormUrl = window.location.href;
  return { fields, url: window.location.href };
}

function handleApplyFill({ plan }) {
  if (lastFormUrl !== window.location.href) {
    return { applied: 0, failed: 0, reason: 'page-changed' };
  }
  return applyFill(plan || [], lastFormMap);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== 'string' || !message.type.startsWith('snapfill.')) return undefined;

  try {
    switch (message.type) {
      case MSG.PING: sendResponse({ ok: true }); break;
      case MSG.SERIALIZE_FORM: sendResponse(handleSerializeForm()); break;
      case MSG.APPLY_FILL: sendResponse(handleApplyFill(message)); break;
      default: sendResponse({ ok: false, error: `unknown message ${message.type}` });
    }
  } catch (err) {
    sendResponse({ ok: false, error: err.message });
  }
  return true;
});

console.debug('[Snapfill] content script ready');
