// Learn orchestration for the side panel.
//
// Reuses the tested pure helpers from learn-engine (prompt building, action
// parsing) but runs the loop across the messaging boundary: the LLM call
// happens here (extension context, no page CSP), while perceive / freeze /
// execute are delegated to the content script in the target tab.

import { buildAgentMessages, parseAgentAction } from '../../core/learn-engine.js';
import { chatJSON } from '../../core/llm-client.js';
import { SkillRecorder } from '../../core/recorder.js';
import { MSG, sendToTab } from '../../shared/messages.js';

function waitTabComplete(tabId, timeout = 20000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) return resolve();
        if (tab.status === 'complete' || Date.now() - start > timeout) return resolve();
        setTimeout(tick, 200);
      });
    };
    setTimeout(tick, 200);
  });
}

/**
 * Learn a task by driving the content script in `tabId`. Returns a recorder
 * holding the frozen steps (call recorder.toSkill(...) to persist).
 */
export async function learnViaTab(task, tabId, llmConfig, { maxSteps = 30, onStep } = {}) {
  const recorder = new SkillRecorder();
  const history = [];

  for (let i = 0; i < maxSteps; i += 1) {
    const perceived = await sendToTab(tabId, { type: MSG.PERCEIVE });
    const messages = buildAgentMessages(task, perceived.text, { url: perceived.url, history });

    let action;
    try {
      action = parseAgentAction(await chatJSON(messages, llmConfig));
    } catch (err) {
      return { ok: false, reason: 'bad-action', error: err.message, recorder };
    }

    if (action.action === 'done') {
      return { ok: true, reason: action.reason || 'done', recorder };
    }

    if (action.action === 'navigate') {
      recorder.recordNavigate(action.url);
      await chrome.tabs.update(tabId, { url: action.url });
      await waitTabComplete(tabId);
      history.push(`navigate ${action.url}`);
      if (onStep) onStep({ i, action, ok: true });
      continue;
    }

    const res = await sendToTab(tabId, {
      type: MSG.EXECUTE_FREEZE,
      action: action.action,
      index: action.index,
      value: action.value,
    });

    if (!res || !res.ok) {
      history.push(`(failed: ${action.action} [${action.index}])`);
      if (onStep) onStep({ i, action, ok: false, error: res?.error });
      continue;
    }

    recorder.steps.push(res.step); // frozen step returned by the content script
    history.push(`${action.action} [${action.index}]${action.value ? ` "${action.value}"` : ''}`);
    if (onStep) onStep({ i, action, ok: true, step: res.step });
  }

  return { ok: false, reason: 'max-steps', recorder };
}
