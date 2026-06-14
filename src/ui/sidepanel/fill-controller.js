// Form-fill orchestration for the side panel: serialize the form (content),
// map profile -> fields with the chosen model (Nano-first, endpoint fallback),
// and return a preview to confirm before applying.

import { buildFillPrompt, parseFillPlan, describePlan } from '../../core/form-fill.js';
import { resolveChatJSON } from '../../core/nano-client.js';
import { loadProfile } from '../../shared/profile.js';
import { loadLLMConfig, loadFillProvider } from '../../shared/config.js';
import { MSG, sendToTab } from '../../shared/messages.js';

/** Build a fill plan + preview for the form in `tabId` (does not fill yet). */
export async function planFillForTab(tabId) {
  let res;
  try {
    res = await sendToTab(tabId, { type: MSG.SERIALIZE_FORM });
  } catch (err) {
    return { ok: false, reason: 'no-content', error: err.message };
  }
  const fields = res?.fields || [];
  if (fields.length === 0) return { ok: false, reason: 'no-fields' };

  const profile = await loadProfile();
  if (!profile || Object.keys(profile).length === 0) return { ok: false, reason: 'no-profile' };

  const [llmConfig, provider] = await Promise.all([loadLLMConfig(), loadFillProvider()]);
  const { fn, usingNano } = await resolveChatJSON({ provider, llmConfig });

  let response;
  try {
    response = await fn(buildFillPrompt(profile, fields));
  } catch (err) {
    return { ok: false, reason: 'llm-failed', error: err.message };
  }

  const plan = parseFillPlan(response, fields);
  if (plan.length === 0) return { ok: false, reason: 'nothing-matched', usingNano, fieldCount: fields.length };

  return { ok: true, plan, preview: describePlan(plan, fields), usingNano, fieldCount: fields.length };
}

/** Apply a confirmed plan to the form in `tabId`. */
export async function applyFillToTab(tabId, plan) {
  return sendToTab(tabId, { type: MSG.APPLY_FILL, plan });
}
