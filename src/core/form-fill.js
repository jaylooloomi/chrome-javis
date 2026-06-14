// Form-fill core — map a user profile to a page's form fields with one LLM
// call, then apply the result. This is a single-shot special case of the agent
// (semantic field matching), which is exactly what a small on-device model like
// Gemini Nano is good at.
//
// Pure + DOM-pure (no Chrome APIs, LLM injected), so it's unit-testable. The
// model call is a function `(messages, config) => Promise<object>` (e.g.
// chatJSON over Nano or the configured endpoint).

import { serializeForm } from './dom-serializer.js';

export const FILL_SYSTEM_PROMPT = `You fill in web forms from a user's profile. You are given the profile (JSON) and the form's fields (each with an index, type, label, and options). Map profile data to fields.

Reply with ONLY JSON:
{"fills":[{"index":<n>,"value":<string|boolean>}],"skipped":[{"index":<n>,"reason":"..."}]}

Rules:
- Use only the provided field indices.
- For select/radio, "value" MUST be one of that field's options (exact text).
- For checkbox, "value" is true or false.
- NEVER invent data that isn't in the profile. If no profile data matches a field, skip it.
- Always skip password fields.
- Prefer required fields.`;

function normalize(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Format the field list for the prompt. */
function formatFields(fields) {
  return fields
    .map((f) => {
      const parts = [`[${f.index}] ${f.type}`];
      if (f.label) parts.push(`"${f.label}"`);
      if (f.required) parts.push('(required)');
      if (f.placeholder) parts.push(`placeholder="${f.placeholder}"`);
      if (f.options && f.options.length) parts.push(`options=[${f.options.join(' | ')}]`);
      return parts.join(' ');
    })
    .join('\n');
}

/** Build the messages mapping a profile to the form fields. */
export function buildFillPrompt(profile, fields) {
  return [
    { role: 'system', content: FILL_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Profile:\n${JSON.stringify(profile || {}, null, 2)}\n\nForm fields:\n${formatFields(fields)}\n\nReply with JSON only.`,
    },
  ];
}

const TRUTHY = new Set(['true', 'yes', '1', 'on', 'checked']);

/** Coerce/validate a model-proposed value for a field. Returns undefined to skip. */
export function coerceValue(field, value) {
  if (value == null) return undefined;
  if (field.type === 'password') return undefined; // never fill passwords

  if (field.type === 'checkbox') {
    if (typeof value === 'boolean') return value;
    return TRUTHY.has(normalize(value));
  }

  if (field.type === 'select' || field.type === 'radio') {
    const opts = field.options || [];
    const target = normalize(value);
    const exact = opts.find((o) => normalize(o) === target);
    if (exact !== undefined) return exact;
    const partial = opts.find((o) => normalize(o).includes(target) || target.includes(normalize(o)));
    return partial; // undefined if no option matches -> skip
  }

  const str = String(value).trim();
  if (!str) return undefined;
  if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) return undefined;
  return str;
}

/** Validate + normalize a raw model response into an applyable plan. */
export function parseFillPlan(response, fields) {
  const byIndex = new Map(fields.map((f) => [f.index, f]));
  const raw = Array.isArray(response?.fills) ? response.fills : [];
  const plan = [];
  for (const item of raw) {
    if (!item || !Number.isInteger(item.index) || !byIndex.has(item.index)) continue;
    const field = byIndex.get(item.index);
    const value = coerceValue(field, item.value);
    if (value === undefined) continue;
    plan.push({ index: item.index, value });
  }
  return plan;
}

/** Human-readable preview rows: [{index, label, value}]. */
export function describePlan(plan, fields) {
  const byIndex = new Map(fields.map((f) => [f.index, f]));
  return plan.map((p) => ({
    index: p.index,
    label: byIndex.get(p.index)?.label || byIndex.get(p.index)?.name || `field ${p.index}`,
    value: p.value,
  }));
}

// --- DOM application -------------------------------------------------------

function fire(el, type) {
  el.dispatchEvent(new Event(type, { bubbles: true }));
}

function setValue(el, value) {
  const proto = el.tagName === 'TEXTAREA'
    ? globalThis.HTMLTextAreaElement.prototype
    : globalThis.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  fire(el, 'input');
  fire(el, 'change');
}

function setSelect(el, value) {
  const opts = Array.from(el.options);
  const opt = opts.find((o) => normalize(o.value) === normalize(value))
    || opts.find((o) => normalize(o.label || o.textContent) === normalize(value));
  if (opt) {
    el.value = opt.value;
    fire(el, 'change');
    return true;
  }
  return false;
}

function setCheckbox(el, value) {
  el.checked = !!value;
  fire(el, 'click');
  fire(el, 'change');
}

function setRadio(ref, value) {
  const target = normalize(value);
  const opt = ref.options.find((o) => normalize(o.label) === target || normalize(o.value) === target)
    || ref.options.find((o) => normalize(o.label).includes(target));
  if (opt) {
    opt.el.checked = true;
    fire(opt.el, 'click');
    fire(opt.el, 'change');
    return true;
  }
  return false;
}

/**
 * Apply a validated plan to the live form via `map` (from serializeForm).
 * Returns { applied, failed } counts.
 */
export function applyFill(plan, map) {
  let applied = 0;
  let failed = 0;
  for (const { index, value } of plan) {
    const ref = map.get(index);
    if (!ref || (ref.el && !ref.el.isConnected)) { failed += 1; continue; }
    let ok = true;
    switch (ref.kind) {
      case 'value': setValue(ref.el, value); break;
      case 'select': ok = setSelect(ref.el, value); break;
      case 'checkbox': setCheckbox(ref.el, value); break;
      case 'radio': ok = setRadio(ref, value); break;
      default: ok = false;
    }
    if (ok) applied += 1; else failed += 1;
  }
  return { applied, failed };
}

/**
 * End-to-end fill against a local DOM (used in tests; the extension splits
 * perceive/apply across the messaging boundary). With { dryRun: true } it
 * returns the plan for preview without touching the page.
 */
export async function fillForm(root, profile, { llm, llmConfig = {}, dryRun = false } = {}) {
  const { fields, map } = serializeForm(root);
  if (fields.length === 0) return { fields, plan: [], applied: 0, failed: 0, reason: 'no-fields' };

  let response;
  try {
    response = await llm(buildFillPrompt(profile, fields), llmConfig);
  } catch (err) {
    return { fields, plan: [], applied: 0, failed: 0, reason: 'llm-failed', error: err.message };
  }

  const plan = parseFillPlan(response, fields);
  if (dryRun) return { fields, plan, preview: describePlan(plan, fields) };

  const { applied, failed } = applyFill(plan, map);
  return { fields, plan, applied, failed };
}
