// Message types exchanged between the side panel (orchestrator + LLM + store),
// the content script (DOM perceive / freeze / replay), and the service worker
// (tab + navigation host actions).

export const MSG = Object.freeze({
  // side panel -> content (in the active tab)
  PERCEIVE: 'javis.perceive', // -> { text, count, url }
  EXECUTE_FREEZE: 'javis.executeFreeze', // { action, index, value } -> { ok, step | error }
  EXECUTE_STEP: 'javis.executeStep', // { step, params } -> { ok | error, reason }
  FREEZE_INDEX: 'javis.freezeIndex', // { index } -> { ok, bundle | error }  (no execute)
  REPLAY_SKILL: 'javis.replaySkill', // { skill, params } -> ReplayResult
  SERIALIZE_FORM: 'javis.serializeForm', // -> { fields }  (map kept in content)
  APPLY_FILL: 'javis.applyFill', // { plan } -> { applied, failed }
  PING: 'javis.ping', // -> { ok: true }

  // content -> service worker (host actions)
  HOST_ACTION: 'javis.hostAction', // { action, url?, value? } -> { ok }
});

/** Send a message to the content script of a specific tab. */
export function sendToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(response);
    });
  });
}

/** Send a message to the extension's service worker / other extension pages. */
export function sendRuntime(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(response);
    });
  });
}
