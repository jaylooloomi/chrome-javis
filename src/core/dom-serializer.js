// Form serialization — turn a page's fillable fields into an LLM-facing schema
// plus an index->element map. Layout-free so it works in jsdom and the browser
// alike (visibility is judged by computed style, not measured geometry).

import { accessibleName } from './selector-engine.js';

/** Layout-free visibility check (excludes display:none/hidden/aria-hidden). */
export function isVisible(el) {
  if (el.hasAttribute('hidden')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  const view = (el.ownerDocument || globalThis.document)?.defaultView;
  const style = view?.getComputedStyle?.(el);
  if (style) {
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  }
  return true;
}

const NON_FILLABLE_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'file']);

/** Is this control something we can autofill? */
export function isFillable(el) {
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea' || tag === 'select') return !el.disabled;
  if (tag === 'input') {
    const t = (el.getAttribute('type') || 'text').toLowerCase();
    return !el.disabled && !NON_FILLABLE_INPUT_TYPES.has(t);
  }
  return false;
}

function normalizeWs(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

function radioGroupLabel(el) {
  const fs = el.closest && el.closest('fieldset');
  const legend = fs && fs.querySelector('legend');
  if (legend) return accessibleName(legend) || normalizeWs(legend.textContent);
  return el.getAttribute('name') || '';
}

/**
 * Serialize a page's fillable form fields into an LLM-facing schema plus a
 * map from index to the live element(s). Radio inputs are grouped by name into
 * a single field with options.
 *
 * @returns {{fields: Array, map: Map<number, object>}}
 */
export function serializeForm(root = globalThis.document, { max = 120 } = {}) {
  const scope = root.nodeType === 9 ? root.body : root;
  const fields = [];
  const map = new Map();
  if (!scope) return { fields, map };

  const radioGroups = new Map(); // name -> field
  let idx = 0;

  for (const el of scope.querySelectorAll('input, select, textarea')) {
    if (idx >= max) break;
    if (!isFillable(el) || !isVisible(el)) continue;

    const tag = el.tagName.toLowerCase();
    const type = tag === 'input' ? (el.getAttribute('type') || 'text').toLowerCase() : tag;

    if (type === 'radio') {
      const name = el.getAttribute('name') || `__radio_${idx}`;
      let group = radioGroups.get(name);
      if (!group) {
        group = { index: idx, type: 'radio', name, label: radioGroupLabel(el), required: !!el.required, options: [] };
        radioGroups.set(name, group);
        fields.push(group);
        map.set(idx, { kind: 'radio', options: [] });
        idx += 1;
      }
      const optLabel = accessibleName(el) || el.value;
      group.options.push(optLabel);
      map.get(group.index).options.push({ label: optLabel, value: el.value, el });
      continue;
    }

    const field = {
      index: idx,
      type,
      name: el.getAttribute('name') || '',
      label: accessibleName(el),
      required: !!el.required,
      placeholder: el.getAttribute('placeholder') || '',
    };

    if (type === 'select') {
      field.options = Array.from(el.options).map((o) => normalizeWs(o.label || o.textContent));
      map.set(idx, { kind: 'select', el });
    } else if (type === 'checkbox') {
      field.value = el.checked;
      map.set(idx, { kind: 'checkbox', el });
    } else {
      field.value = el.value;
      map.set(idx, { kind: 'value', el });
    }
    fields.push(field);
    idx += 1;
  }

  return { fields, map };
}
