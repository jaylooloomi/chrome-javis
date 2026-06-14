// Learn Engine — the "learn once" loop.
//
// Drives a task to completion by reasoning over the indexed DOM, and freezes
// each successful action into a skill as it goes. Crucially, execution reuses
// the SAME replay path as deterministic replay (recorder freezes a step ->
// replayStep executes it), so anything learned is guaranteed replayable.
//
// The LLM is injected (default: chatJSON) so the orchestration is unit-testable
// with a scripted model; only the quality of a *real* model's decisions needs a
// live browser to evaluate.

import { serializeInteractive } from './dom-serializer.js';
import { chatJSON } from './llm-client.js';
import { SkillRecorder } from './recorder.js';
import { replayStep } from './replay-engine.js';
import { ACTIONS } from '../shared/actions.js';

export const AGENT_SYSTEM_PROMPT = `You are a web-automation agent. You are shown the interactive elements of the current page as an indexed list, like:
[0]<button>Search</button>
[1]<input type="text" placeholder="Query">

Decide the SINGLE next action to accomplish the user's task. Respond with ONLY a JSON object, no prose:
{"thought": "...", "action": "click|input|select|scroll|navigate|done", "index": <number for click/input/select/scroll>, "value": "<text for input/select>", "url": "<for navigate>", "reason": "<for done: why the task is complete or impossible>"}

Rules:
- Use the index numbers exactly as shown.
- For "input", set both "index" and "value".
- Use "navigate" with a "url" only to load a page.
- Use "done" when the task is complete OR cannot proceed; put the explanation in "reason".
- Exactly one action per response.`;

/** Build the per-step message list for the agent. */
export function buildAgentMessages(task, domText, { url = '', history = [] } = {}) {
  const historyText = history.length
    ? `\nActions so far:\n${history.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
    : '';
  return [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Task: ${task}\n\nCurrent URL: ${url || '(unknown)'}\n\nInteractive elements:\n${domText || '(none)'}${historyText}\n\nReply with the next action as JSON.`,
    },
  ];
}

/** Validate and normalize an action object returned by the LLM. */
export function parseAgentAction(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('agent action is not an object');
  const action = obj.action;
  const known = ['click', 'input', 'select', 'scroll', 'navigate', 'done'];
  if (!known.includes(action)) throw new Error(`unknown agent action: ${action}`);
  if (['click', 'input', 'select', 'scroll'].includes(action) && !Number.isInteger(obj.index)) {
    throw new Error(`action '${action}' requires an integer index`);
  }
  if (action === 'input' && obj.value == null) throw new Error("action 'input' requires a value");
  if (action === 'navigate' && !obj.url) throw new Error("action 'navigate' requires a url");
  return {
    action,
    index: obj.index,
    value: obj.value,
    url: obj.url,
    thought: obj.thought || '',
    reason: obj.reason || '',
  };
}

const RECORD_FOR_ACTION = {
  [ACTIONS.CLICK]: (rec, el) => rec.recordClick(el),
  [ACTIONS.INPUT]: (rec, el, value) => rec.recordInput(el, value),
  [ACTIONS.SELECT]: (rec, el, value) => rec.recordSelect(el, value),
  [ACTIONS.SCROLL]: (rec, el) => rec.recordScroll(el),
};

/**
 * Learn a task. Returns the frozen skill plus a transcript.
 *
 * @returns {Promise<{ok:boolean, reason:string, skill:object, transcript:Array}>}
 */
export async function learnTask(task, {
  root = globalThis.document,
  llmConfig = {},
  llm = chatJSON,
  host = {},
  maxSteps = 30,
  startUrl = '',
  onStep,
  recorder = new SkillRecorder(),
} = {}) {
  const transcript = [];
  const history = [];
  if (startUrl) {
    const step = recorder.recordNavigate(startUrl);
    await replayStep(step, { host });
  }

  for (let stepNum = 0; stepNum < maxSteps; stepNum += 1) {
    const { text, map } = serializeInteractive(root);
    const url = (root.location || root.ownerDocument?.location)?.href || startUrl;
    const messages = buildAgentMessages(task, text, { url, history });

    let action;
    try {
      action = parseAgentAction(await llm(messages, llmConfig));
    } catch (err) {
      transcript.push({ stepNum, error: `bad-action: ${err.message}` });
      return { ok: false, reason: 'bad-action', skill: recorder.toSkill({ name: task }), transcript };
    }

    if (action.action === 'done') {
      transcript.push({ stepNum, action: 'done', reason: action.reason });
      return { ok: true, reason: action.reason || 'done', skill: recorder.toSkill({ name: task }), transcript };
    }

    if (action.action === ACTIONS.NAVIGATE) {
      const step = recorder.recordNavigate(action.url);
      try {
        await replayStep(step, { host });
      } catch (err) {
        transcript.push({ stepNum, error: `navigate-failed: ${err.message}` });
        return { ok: false, reason: 'navigate-failed', skill: recorder.toSkill({ name: task }), transcript };
      }
      history.push(`navigate ${action.url}`);
      if (onStep) onStep({ stepNum, action, step });
      continue;
    }

    // DOM action: resolve index -> live element, freeze, execute via replay path.
    const el = map.get(action.index);
    if (!el) {
      transcript.push({ stepNum, error: `no element at index ${action.index}` });
      history.push(`(failed: no element at [${action.index}])`);
      continue; // let the LLM re-perceive and retry
    }

    const record = RECORD_FOR_ACTION[action.action];
    const step = record(recorder, el, action.value);
    try {
      await replayStep(step, { root, host });
    } catch (err) {
      // The freeze didn't resolve/execute — drop it and let the agent retry.
      recorder.steps.pop();
      transcript.push({ stepNum, error: `execute-failed: ${err.message}` });
      history.push(`(failed: ${action.action} [${action.index}])`);
      continue;
    }

    transcript.push({ stepNum, action: action.action, index: action.index, value: action.value });
    history.push(`${action.action} [${action.index}]${action.value ? ` "${action.value}"` : ''}`);
    if (onStep) onStep({ stepNum, action, step });
  }

  return { ok: false, reason: 'max-steps', skill: recorder.toSkill({ name: task }), transcript };
}
