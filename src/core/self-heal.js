// Self-heal — layered degradation for replay.
//
// Strategy (from the research: pure-rule healing alone is too weak):
//   1. deterministic replay (zero LLM) — handled by the replay engine.
//   2. on 'selector-not-found', call `relocate` to find the element again
//      (in the extension: perceive + LLM pick + re-freeze) and retry once.
//   3. if relocation/retry fails, stop and report (the UI then asks the user).
//
// This module owns layer 2's orchestration. `relocate` is injected so the loop
// is unit-testable without a browser or model; it returns a fresh
// SelectorBundle (or null) for the failing step.

import { replayStep, ReplayError } from './replay-engine.js';

export const RELOCATE_SYSTEM_PROMPT = `You help re-locate a UI element that has moved or changed. You are given a recorded step's intent and the current page's indexed interactive elements. Pick the index of the element that best matches the recorded intent. Reply with ONLY JSON: {"index": <number>} or {"found": false} if nothing matches.`;

function mergeParams(skill, callerParams) {
  const defaults = {};
  for (const p of skill.params || []) {
    if (p && p.name && p.default !== undefined) defaults[p.name] = p.default;
  }
  return { ...defaults, ...(callerParams || {}) };
}

/** Human-readable summary of a step's intent, for the relocate prompt. */
export function describeStepIntent(step) {
  const parts = [`action=${step.action}`];
  if (step.value) parts.push(`value="${step.value}"`);
  const cands = step.selector?.candidates || [];
  const text = cands.find((c) => c.type === 'text');
  if (text) parts.push(`text="${text.value}"`);
  const rn = cands.find((c) => c.type === 'role+name');
  if (rn) parts.push(`role=${rn.value.role} name="${rn.value.name}"`);
  if (step.selector?.tag) parts.push(`tag=${step.selector.tag}`);
  return parts.join(', ');
}

/** Build the messages asking the model to re-locate a moved element. */
export function buildRelocateMessages(step, domText, { url = '' } = {}) {
  return [
    { role: 'system', content: RELOCATE_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Recorded step intent: ${describeStepIntent(step)}\nCurrent URL: ${url || '(unknown)'}\n\nCurrent interactive elements:\n${domText || '(none)'}\n\nReply with JSON only.`,
    },
  ];
}

/** Parse the model's relocate reply into an index, or null. */
export function parseRelocateResponse(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.found === false) return null;
  return Number.isInteger(obj.index) ? obj.index : null;
}

/**
 * Replay a skill with self-heal. On 'selector-not-found', calls
 * ctx.relocate({step, stepIndex}) -> SelectorBundle|null and retries the step
 * once with the new bundle, reporting re-frozen steps via ctx.onReheal.
 *
 * @returns {Promise<{ok:boolean, completed?:number, failedStep?:number, reason?:string, healed:boolean, healedSteps:Array, results:Array}>}
 */
export async function replaySkillWithHeal(skill, ctx = {}) {
  const params = mergeParams(skill, ctx.params);
  const stepCtx = { ...ctx, params };
  const steps = skill.steps || [];
  const results = [];
  const healedSteps = [];

  const fail = (i, reason, error, step) => {
    if (ctx.onError) ctx.onError({ stepIndex: i, step, error, reason });
    return { ok: false, failedStep: i, reason, error, healed: healedSteps.length > 0, healedSteps, results };
  };

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    try {
      results.push(await replayStep(step, stepCtx, i));
      continue;
    } catch (err) {
      const reason = err instanceof ReplayError ? err.reason : 'error';
      if (reason !== 'selector-not-found' || typeof ctx.relocate !== 'function') {
        return fail(i, reason, err, step);
      }

      // Layer 2: relocate + retry once.
      let bundle = null;
      try {
        bundle = await ctx.relocate({ step, stepIndex: i });
      } catch {
        bundle = null;
      }
      if (!bundle) return fail(i, 'heal-failed', err, step);

      const healedStep = { ...step, selector: bundle };
      try {
        results.push(await replayStep(healedStep, stepCtx, i));
        healedSteps.push({ stepIndex: i, step: healedStep });
        if (ctx.onReheal) ctx.onReheal({ stepIndex: i, step: healedStep });
        continue;
      } catch (err2) {
        return fail(i, 'heal-retry-failed', err2, healedStep);
      }
    }
  }

  return { ok: true, completed: steps.length, healed: healedSteps.length > 0, healedSteps, results };
}
