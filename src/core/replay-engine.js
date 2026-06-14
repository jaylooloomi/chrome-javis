// Replay Engine — deterministic, zero-LLM execution of a frozen skill.
//
// Given a skill (ordered declarative steps), it resolves each step's
// SelectorBundle, performs the action, and applies the step's wait condition.
// Non-DOM actions (navigation, tabs) are delegated to an injected `host` so the
// engine stays pure and unit-testable. When a DOM step's selector can no longer
// be resolved, it throws a ReplayError with reason 'selector-not-found' — the
// signal the self-heal layer (P7) listens for.

import { resolveSelectorBundle } from './selector-engine.js';
import { ACTIONS, DOM_ACTIONS, HOST_ACTIONS, WAIT_TYPES } from '../shared/actions.js';

export class ReplayError extends Error {
  constructor(message, reason, stepIndex) {
    super(message);
    this.name = 'ReplayError';
    this.reason = reason;
    this.stepIndex = stepIndex;
  }
}

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

function withDefaults(ctx) {
  return {
    root: ctx.root || globalThis.document,
    host: ctx.host || {},
    resolve: ctx.resolve || resolveSelectorBundle,
    params: ctx.params || {},
    pollInterval: ctx.pollInterval ?? 50,
    timeout: ctx.timeout ?? 10000,
    sleep: ctx.sleep || realSleep,
    now: ctx.now || (() => Date.now()),
    onStep: ctx.onStep,
    onError: ctx.onError,
  };
}

/** Substitute {{param}} placeholders in a string value. */
export function interpolate(value, params = {}) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const v = params[key];
    return v == null ? '' : String(v);
  });
}

// ---------------------------------------------------------------------------
// Low-level DOM action helpers (fire realistic event sequences)
// ---------------------------------------------------------------------------

function fireMouse(el, type) {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
}

function fireEvent(el, type) {
  el.dispatchEvent(new Event(type, { bubbles: true }));
}

function performClick(el) {
  if (typeof el.focus === 'function') el.focus();
  fireMouse(el, 'mousedown');
  fireMouse(el, 'mouseup');
  fireMouse(el, 'click');
}

/** Set a control's value via the native setter so framework listeners fire. */
function setNativeValue(el, value) {
  const proto = el.tagName === 'TEXTAREA'
    ? globalThis.HTMLTextAreaElement.prototype
    : globalThis.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

function performInput(el, value) {
  if (typeof el.focus === 'function') el.focus();
  setNativeValue(el, value ?? '');
  fireEvent(el, 'input');
  fireEvent(el, 'change');
}

function performSelect(el, value) {
  if (el.tagName === 'SELECT') {
    const opts = Array.from(el.options);
    const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
    const opt = opts.find((o) => o.value === value) || opts.find((o) => norm(o.textContent) === norm(value));
    el.value = opt ? opt.value : value;
    fireEvent(el, 'change');
  } else {
    performClick(el);
  }
}

function performScroll(el) {
  if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' });
}

async function performDomAction(action, el, value) {
  switch (action) {
    case ACTIONS.CLICK: return performClick(el);
    case ACTIONS.INPUT: return performInput(el, value);
    case ACTIONS.SELECT: return performSelect(el, value);
    case ACTIONS.SCROLL: return performScroll(el);
    default: throw new ReplayError(`unsupported DOM action: ${action}`, 'unknown-action');
  }
}

async function performHostAction(action, value, step, ctx) {
  const { host } = ctx;
  const need = (fn, name) => {
    if (typeof host[fn] !== 'function') throw new ReplayError(`host.${name} not provided`, 'no-host');
    return host[fn];
  };
  switch (action) {
    case ACTIONS.NAVIGATE: return need('navigate', 'navigate')(value ?? interpolate(step.url, ctx.params));
    case ACTIONS.OPEN_TAB: return need('openTab', 'openTab')(value ?? interpolate(step.url, ctx.params));
    case ACTIONS.CLOSE_TAB: return need('closeTab', 'closeTab')();
    case ACTIONS.SWITCH_TAB: return need('switchTab', 'switchTab')(value);
    default: throw new ReplayError(`unsupported host action: ${action}`, 'unknown-action');
  }
}

// ---------------------------------------------------------------------------
// Waiting
// ---------------------------------------------------------------------------

export async function waitForCondition(wait, ctx) {
  const c = withDefaults(ctx);
  if (!wait || wait.type === WAIT_TYPES.NONE) return;

  if (wait.type === WAIT_TYPES.DELAY) {
    await c.sleep(wait.ms ?? 0);
    return;
  }

  const deadline = c.now() + (wait.timeout ?? c.timeout);

  if (wait.type === WAIT_TYPES.LOAD) {
    while (c.now() < deadline) {
      const doc = c.root.ownerDocument || c.root;
      if (!doc || doc.readyState === 'complete') return;
      await c.sleep(c.pollInterval);
    }
    return; // a load wait that overruns is non-fatal
  }

  if ((wait.type === WAIT_TYPES.ELEMENT || wait.type === WAIT_TYPES.GONE) && !wait.selector) {
    throw new ReplayError(`wait '${wait.type}' requires a selector bundle`, 'invalid-wait');
  }

  while (c.now() < deadline) {
    const found = c.resolve(wait.selector, c.root);
    if (wait.type === WAIT_TYPES.ELEMENT && found) return;
    if (wait.type === WAIT_TYPES.GONE && !found) return;
    await c.sleep(c.pollInterval);
  }
  throw new ReplayError(`wait '${wait.type}' timed out`, 'wait-timeout');
}

// ---------------------------------------------------------------------------
// Step & skill execution
// ---------------------------------------------------------------------------

/**
 * Execute a single step. Throws ReplayError on failure (selector-not-found,
 * wait-timeout, no-host, unknown-action).
 */
export async function replayStep(step, ctx, stepIndex = 0) {
  const c = withDefaults(ctx);
  const action = step.action;
  const value = interpolate(step.value, c.params);
  let candidateUsed = null;

  if (DOM_ACTIONS.has(action)) {
    if (!step.selector || !Array.isArray(step.selector.candidates)) {
      throw new ReplayError(`step ${stepIndex} (${action}) is missing a selector bundle`, 'malformed-step', stepIndex);
    }
    const res = c.resolve(step.selector, c.root);
    if (!res) {
      throw new ReplayError(`could not resolve element for step ${stepIndex} (${action})`, 'selector-not-found', stepIndex);
    }
    candidateUsed = res.candidate;
    await performDomAction(action, res.element, value);
  } else if (HOST_ACTIONS.has(action)) {
    await performHostAction(action, value, step, c);
  } else if (action === ACTIONS.WAIT_FOR) {
    // no-op; the wait below performs the work
  } else {
    throw new ReplayError(`unknown action: ${action}`, 'unknown-action', stepIndex);
  }

  if (step.wait) await waitForCondition(step.wait, c);

  if (c.onStep) c.onStep({ stepIndex, step, candidateUsed });
  return { ok: true, stepIndex, candidateUsed };
}

/**
 * Replay a full skill. Stops at the first failing step and reports its index
 * and reason so the self-heal layer can act. Param defaults declared on the
 * skill are merged under any caller-supplied params.
 *
 * @returns {Promise<{ok:boolean, completed:number, failedStep?:number, reason?:string, error?:Error, results:Array}>}
 */
export async function replaySkill(skill, ctx = {}) {
  const c = withDefaults(ctx);
  const paramDefaults = {};
  for (const p of skill.params || []) {
    if (p && p.name && p.default !== undefined) paramDefaults[p.name] = p.default;
  }
  c.params = { ...paramDefaults, ...(ctx.params || {}) };

  const steps = skill.steps || [];
  const results = [];
  for (let i = 0; i < steps.length; i += 1) {
    try {
      results.push(await replayStep(steps[i], c, i));
    } catch (err) {
      const reason = err instanceof ReplayError ? err.reason : 'error';
      if (c.onError) c.onError({ stepIndex: i, step: steps[i], error: err, reason });
      return { ok: false, completed: i, failedStep: i, reason, error: err, results };
    }
  }
  return { ok: true, completed: steps.length, results };
}
