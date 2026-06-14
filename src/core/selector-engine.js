// Selector Engine — the heart of the "freeze" vision.
//
// Two responsibilities, kept deliberately pure (no Chrome APIs, no layout):
//
//   computeSelectorBundle(el)  — turn a live DOM node into a *bundle* of
//       stable, prioritized fallback selectors. Used at freeze time.
//   resolveSelectorBundle(bundle) — given a bundle, find the element again by
//       trying candidates in priority order. Used at replay time.
//
// Design rule from the research: NEVER persist a volatile runtime index. A
// frozen step must carry several independent ways to re-find its element so
// replay survives DOM drift, and so self-heal only kicks in when all of them
// fail.
//
// Candidate priority (higher score = tried first):
//   testid (100) > id (90) > name (85) > role+name (80) > text (60)
//   > css path (40) > xpath (10)

/** Attributes treated as test ids, in order of preference. */
const TESTID_ATTRS = ['data-testid', 'data-test-id', 'data-test', 'data-cy', 'data-qa'];

/** Interactive elements eligible for text-based matching. */
const INTERACTIVE_SELECTOR = 'a,button,summary,label,[role="button"],[role="link"],[role="tab"],[role="menuitem"],input[type="button"],input[type="submit"]';

const SCORES = {
  testid: 100,
  id: 90,
  name: 85,
  'role+name': 80,
  text: 60,
  css: 40,
  xpath: 10,
};

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

/** Collapse runs of whitespace and trim. Returns '' for nullish input. */
function normalizeText(value) {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

/** CSS.escape with a conservative fallback for environments lacking it. */
function cssEscape(value) {
  const css = globalThis.CSS;
  if (css && typeof css.escape === 'function') return css.escape(value);
  // Minimal fallback: escape characters that are unsafe in a CSS identifier.
  return String(value).replace(/([^a-zA-Z0-9_-])/g, '\\$1');
}

/**
 * Heuristic: is this id stable enough to select on, or is it a
 * framework-generated value that changes between renders?
 */
export function isStableId(id) {
  if (!id || typeof id !== 'string') return false;
  const v = id.trim();
  if (!v || v.length > 64) return false;
  const dynamicPatterns = [
    /^:r[0-9a-z]+:$/i, // React useId — ":r0:"
    /^react-/i,
    /^ember\d+/i,
    /^mui-\d+$/i,
    /^headlessui-/i,
    /^radix-[:a-z0-9-]+/i,
    /^downshift-/i,
    /^[0-9a-f]{8,}$/i, // hex hash
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i, // uuid-ish
    /\d{4,}/, // any long digit run
  ];
  return !dynamicPatterns.some((re) => re.test(v));
}

/** Owner document of an element (works in jsdom and the browser). */
function docOf(el) {
  return el.ownerDocument || globalThis.document;
}

// ---------------------------------------------------------------------------
// Roles & accessible names (simplified ARIA computation)
// ---------------------------------------------------------------------------

/** Implicit ARIA role for common interactive tags. */
function implicitRole(el) {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case 'a':
    case 'area':
      return el.hasAttribute('href') ? 'link' : null;
    case 'button':
      return 'button';
    case 'select':
      return el.hasAttribute('multiple') ? 'listbox' : 'combobox';
    case 'textarea':
      return 'textbox';
    case 'img':
      return 'img';
    case 'summary':
      return 'button';
    case 'input': {
      const t = (el.getAttribute('type') || 'text').toLowerCase();
      if (['button', 'submit', 'reset', 'image'].includes(t)) return 'button';
      if (t === 'checkbox') return 'checkbox';
      if (t === 'radio') return 'radio';
      if (t === 'range') return 'slider';
      if (t === 'number') return 'spinbutton';
      if (t === 'search') return 'searchbox';
      return 'textbox';
    }
    default:
      return null;
  }
}

/** Explicit role attribute, else the implicit role. */
export function getRole(el) {
  const explicit = normalizeText(el.getAttribute && el.getAttribute('role')).toLowerCase();
  if (explicit) return explicit.split(/\s+/)[0];
  return implicitRole(el);
}

/**
 * Compute the accessible name of an element (simplified algorithm covering the
 * cases that matter for clicking/typing: aria-label, aria-labelledby, labels,
 * alt/title/placeholder/value, and text content).
 */
export function accessibleName(el) {
  if (!el || el.nodeType !== 1) return '';
  const doc = docOf(el);

  const ariaLabel = normalizeText(el.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;

  const labelledBy = normalizeText(el.getAttribute('aria-labelledby'));
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => doc.getElementById(id))
      .filter(Boolean)
      .map((node) => normalizeText(node.textContent))
      .join(' ')
      .trim();
    if (text) return normalizeText(text);
  }

  const tag = el.tagName.toLowerCase();

  // Form controls: associated <label>, then placeholder/value/title.
  if (['input', 'textarea', 'select'].includes(tag)) {
    if (el.id) {
      const label = doc.querySelector(`label[for="${cssEscape(el.id)}"]`);
      if (label) {
        const t = normalizeText(label.textContent);
        if (t) return t;
      }
    }
    const wrapping = el.closest && el.closest('label');
    if (wrapping) {
      const t = normalizeText(wrapping.textContent);
      if (t) return t;
    }
    const placeholder = normalizeText(el.getAttribute('placeholder'));
    if (placeholder) return placeholder;
    const title = normalizeText(el.getAttribute('title'));
    if (title) return title;
    return '';
  }

  if (tag === 'img') {
    return normalizeText(el.getAttribute('alt')) || normalizeText(el.getAttribute('title'));
  }

  const text = normalizeText(el.textContent);
  if (text) return text;

  return normalizeText(el.getAttribute('title'));
}

// ---------------------------------------------------------------------------
// CSS path & XPath builders
// ---------------------------------------------------------------------------

/** 1-based index of el among same-tag siblings. */
function nthOfType(el) {
  let i = 1;
  let sib = el.previousElementSibling;
  while (sib) {
    if (sib.tagName === el.tagName) i += 1;
    sib = sib.previousElementSibling;
  }
  return i;
}

/**
 * Build a structural CSS path, anchoring at the nearest ancestor that has a
 * stable id or test id (or stopping at <body>). Uses :nth-of-type for
 * uniqueness rather than volatile class names.
 */
export function computeCssPath(el) {
  const segments = [];
  let node = el;
  while (node && node.nodeType === 1 && node.tagName.toLowerCase() !== 'html') {
    const tag = node.tagName.toLowerCase();
    if (tag === 'body') {
      segments.unshift('body');
      break;
    }
    // Anchor on a stable id.
    if (node.id && isStableId(node.id)) {
      segments.unshift(`#${cssEscape(node.id)}`);
      break;
    }
    // Anchor on a test id.
    const testAttr = TESTID_ATTRS.find((a) => node.getAttribute && node.getAttribute(a));
    if (testAttr) {
      segments.unshift(`[${testAttr}="${cssEscape(node.getAttribute(testAttr))}"]`);
      break;
    }
    segments.unshift(`${tag}:nth-of-type(${nthOfType(node)})`);
    node = node.parentElement;
  }
  return segments.join(' > ');
}

/** Absolute XPath — unique by construction, brittle by nature (last resort). */
export function computeXPath(el) {
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1) {
    const tag = node.tagName.toLowerCase();
    const idx = nthOfType(node);
    parts.unshift(`${tag}[${idx}]`);
    node = node.parentElement;
  }
  return '/' + parts.join('/');
}

// ---------------------------------------------------------------------------
// Candidate resolution
// ---------------------------------------------------------------------------

/** Find all elements matching a role + accessible name. */
function queryByRoleName(root, role, name) {
  const target = normalizeText(name);
  const all = root.querySelectorAll('*');
  const out = [];
  for (const el of all) {
    if (getRole(el) === role && normalizeText(accessibleName(el)) === target) out.push(el);
  }
  return out;
}

/** Find all interactive elements whose visible text matches. */
function queryByText(root, text) {
  const target = normalizeText(text);
  const out = [];
  for (const el of root.querySelectorAll(INTERACTIVE_SELECTOR)) {
    if (normalizeText(el.textContent) === target) out.push(el);
  }
  return out;
}

/** Resolve a single candidate to a list of matching elements. */
function resolveCandidate(candidate, root) {
  try {
    switch (candidate.type) {
      case 'testid':
      case 'id':
      case 'name':
      case 'css':
        return Array.from(root.querySelectorAll(candidate.value));
      case 'role+name':
        return queryByRoleName(root, candidate.value.role, candidate.value.name);
      case 'text':
        return queryByText(root, candidate.value);
      case 'xpath': {
        const doc = root.ownerDocument || root;
        const result = doc.evaluate(
          candidate.value,
          doc,
          null,
          globalThis.XPathResult ? globalThis.XPathResult.ORDERED_NODE_SNAPSHOT_TYPE : 7,
          null,
        );
        const out = [];
        for (let i = 0; i < result.snapshotLength; i += 1) out.push(result.snapshotItem(i));
        return out;
      }
      default:
        return [];
    }
  } catch {
    return [];
  }
}

/** True if the candidate resolves to exactly `el` and nothing else. */
function resolvesUniquelyTo(candidate, el, root) {
  const matches = resolveCandidate(candidate, root);
  return matches.length === 1 && matches[0] === el;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a prioritized SelectorBundle for a DOM element. Only candidates that
 * currently resolve *uniquely* to the element are included (except XPath, which
 * is unique by construction and always added as a last resort).
 *
 * @param {Element} el
 * @returns {{tag: string, candidates: Array<{type:string, value:any, score:number}>}}
 */
export function computeSelectorBundle(el) {
  if (!el || el.nodeType !== 1) throw new Error('computeSelectorBundle: expected an element');
  const root = docOf(el);
  const candidates = [];
  const add = (type, value) => {
    const candidate = { type, value, score: SCORES[type] };
    if (resolvesUniquelyTo(candidate, el, root)) candidates.push(candidate);
  };

  // 1. test id
  const testAttr = TESTID_ATTRS.find((a) => el.getAttribute(a));
  if (testAttr) add('testid', `[${testAttr}="${cssEscape(el.getAttribute(testAttr))}"]`);

  // 2. stable id
  if (el.id && isStableId(el.id)) add('id', `#${cssEscape(el.id)}`);

  // 3. name attribute (forms)
  const name = el.getAttribute('name');
  if (name) add('name', `${el.tagName.toLowerCase()}[name="${cssEscape(name)}"]`);

  // 4. role + accessible name
  const role = getRole(el);
  const accName = accessibleName(el);
  if (role && accName) {
    const candidate = { type: 'role+name', value: { role, name: accName }, score: SCORES['role+name'] };
    if (resolvesUniquelyTo(candidate, el, root)) candidates.push(candidate);
  }

  // 5. unique visible text (interactive elements)
  if (el.matches && el.matches(INTERACTIVE_SELECTOR)) {
    const text = normalizeText(el.textContent);
    if (text && text.length <= 80) add('text', text);
  }

  // 6. structural CSS path
  const css = computeCssPath(el);
  if (css) add('css', css);

  // 7. absolute XPath (always, as last resort)
  const xpath = computeXPath(el);
  candidates.push({ type: 'xpath', value: xpath, score: SCORES.xpath });

  candidates.sort((a, b) => b.score - a.score);
  return { tag: el.tagName.toLowerCase(), candidates };
}

/**
 * Resolve a SelectorBundle back to an element by trying candidates in priority
 * order. Returns the matched element plus which candidate found it (so callers
 * can detect drift / trigger re-freeze), or null if nothing matched.
 *
 * @param {{candidates: Array}} bundle
 * @param {ParentNode} [root=document]
 * @returns {{element: Element, candidate: object, index: number}|null}
 */
export function resolveSelectorBundle(bundle, root = globalThis.document) {
  if (!bundle || !Array.isArray(bundle.candidates)) return null;
  const ordered = [...bundle.candidates].sort((a, b) => b.score - a.score);
  for (let i = 0; i < ordered.length; i += 1) {
    const matches = resolveCandidate(ordered[i], root);
    if (matches.length >= 1) {
      return { element: matches[0], candidate: ordered[i], index: i };
    }
  }
  return null;
}

export const __internals = { normalizeText, cssEscape, queryByRoleName, queryByText, resolveCandidate };
