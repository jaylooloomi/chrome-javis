// Messages between the side panel (UI + LLM) and the content script (DOM).

export const MSG = Object.freeze({
  PING: 'snapfill.ping', // -> { ok: true }
  SERIALIZE_FORM: 'snapfill.serializeForm', // -> { fields, url }  (map kept in content)
  APPLY_FILL: 'snapfill.applyFill', // { plan } -> { applied, failed, reason? }
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
