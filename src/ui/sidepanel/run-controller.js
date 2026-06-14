// Heal-aware skill run for the side panel.
//
// Replays a skill step-by-step against the content script. On a step's
// 'selector-not-found', it relocates the element (perceive + LLM pick +
// re-freeze in the page) and retries once, then persists the re-frozen step so
// future runs are deterministic again. Mirrors core/self-heal.js but across the
// messaging boundary (LLM runs here; DOM work runs in the content script).

import { chatJSON } from '../../core/llm-client.js';
import { buildRelocateMessages, parseRelocateResponse } from '../../core/self-heal.js';
import { DOM_ACTIONS } from '../../shared/actions.js';
import { MSG, sendToTab } from '../../shared/messages.js';

async function relocate(step, tabId, llmConfig) {
  const perceived = await sendToTab(tabId, { type: MSG.PERCEIVE });
  const messages = buildRelocateMessages(step, perceived.text, { url: perceived.url });
  let index;
  try {
    index = parseRelocateResponse(await chatJSON(messages, llmConfig));
  } catch {
    return null;
  }
  if (index == null) return null;
  const frozen = await sendToTab(tabId, { type: MSG.FREEZE_INDEX, index });
  return frozen?.ok ? frozen.bundle : null;
}

/**
 * Run a skill with self-heal. Returns { ok, healed, updatedSteps?, failedStep?, reason? }.
 * `updatedSteps` is present (and changed) only when a step was re-frozen.
 */
export async function runSkillHealing(skill, params, tabId, llmConfig, { onStep } = {}) {
  const steps = skill.steps || [];
  const updatedSteps = steps.map((s) => ({ ...s }));
  let healed = false;

  for (let i = 0; i < steps.length; i += 1) {
    let step = steps[i];
    let res = await sendToTab(tabId, { type: MSG.EXECUTE_STEP, step, params });

    if (res && !res.ok && res.reason === 'selector-not-found' && DOM_ACTIONS.has(step.action)) {
      const bundle = await relocate(step, tabId, llmConfig);
      if (bundle) {
        step = { ...step, selector: bundle };
        res = await sendToTab(tabId, { type: MSG.EXECUTE_STEP, step, params });
        if (res && res.ok) {
          updatedSteps[i] = step;
          healed = true;
        }
      }
    }

    if (!res || !res.ok) {
      return { ok: false, failedStep: i, reason: res?.reason || 'error', healed };
    }
    if (onStep) onStep({ i, healedHere: updatedSteps[i] !== steps[i] });
  }

  return { ok: true, healed, updatedSteps: healed ? updatedSteps : undefined };
}
