// DOM Serializer — the "perceive" half of the Learn Engine.
//
// Converts a page into a compact, indexed text representation the LLM can act
// on (page-agent / browser-use style), plus an index->element map so a chosen
// index resolves back to a live node. Layout-free so it works in jsdom tests
// and the browser alike (visibility is judged by computed style, not measured
// geometry).

import { accessibleName } from './selector-engine.js';

const ROLE_INTERACTIVE = new Set([
  'button', 'link', 'tab', 'menuitem', 'checkbox', 'radio',
  'combobox', 'textbox', 'switch', 'option', 'searchbox', 'slider',
]);

/** Is this element something a user could act on? */
export function isInteractive(el) {
  const tag = el.tagName.toLowerCase();
  if (tag === 'a') return el.hasAttribute('href');
  if (tag === 'input') return (el.getAttribute('type') || 'text').toLowerCase() !== 'hidden';
  if (['button', 'select', 'textarea', 'summary'].includes(tag)) return true;

  const role = (el.getAttribute('role') || '').toLowerCase();
  if (role && ROLE_INTERACTIVE.has(role)) return true;
  if (el.hasAttribute('onclick')) return true;

  const ce = el.getAttribute('contenteditable');
  if (ce === '' || ce === 'true') return true;

  const ti = el.getAttribute('tabindex');
  if (ti != null && ti !== '-1') return true;

  return false;
}

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

function describeOpenTag(el) {
  const tag = el.tagName.toLowerCase();
  const attrs = [];
  const push = (k, v) => { if (v) attrs.push(`${k}="${String(v).slice(0, 60)}"`); };
  push('type', el.getAttribute('type'));
  push('name', el.getAttribute('name'));
  push('placeholder', el.getAttribute('placeholder'));
  push('role', el.getAttribute('role'));
  push('href', el.getAttribute('href'));
  if (el.tagName === 'INPUT' && el.value) push('value', el.value);
  return `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>`;
}

/**
 * Serialize the interactive elements under `root` (a document or element).
 *
 * @returns {{text: string, map: Map<number, Element>, count: number}}
 */
export function serializeInteractive(root = globalThis.document, { max = 200 } = {}) {
  const scope = root.nodeType === 9 ? root.body : root; // 9 = Document
  const map = new Map();
  const lines = [];
  if (!scope) return { text: '', map, count: 0 };

  let idx = 0;
  for (const el of scope.querySelectorAll('*')) {
    if (idx >= max) break;
    if (!isInteractive(el) || !isVisible(el)) continue;
    const name = accessibleName(el);
    const tag = el.tagName.toLowerCase();
    lines.push(`[${idx}]${describeOpenTag(el)}${name}</${tag}>`);
    map.set(idx, el);
    idx += 1;
  }

  return { text: lines.join('\n'), map, count: idx };
}
