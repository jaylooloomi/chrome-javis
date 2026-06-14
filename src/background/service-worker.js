// Service worker — thin host layer. Opens the side panel on icon click and
// performs tab/navigation actions on behalf of the content script. All product
// logic lives in the side panel + content script + core engines.

import { MSG } from '../shared/messages.js';

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== MSG.HOST_ACTION) return undefined;

  (async () => {
    try {
      const tabId = sender.tab?.id;
      switch (message.action) {
        case 'openTab':
          await chrome.tabs.create({ url: message.url });
          break;
        case 'closeTab':
          if (tabId) await chrome.tabs.remove(tabId);
          break;
        case 'switchTab': {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const target = tabs[Number(message.value)];
          if (target) await chrome.tabs.update(target.id, { active: true });
          break;
        }
        default:
          return sendResponse({ ok: false, error: `unknown host action ${message.action}` });
      }
      return sendResponse({ ok: true });
    } catch (err) {
      return sendResponse({ ok: false, error: err.message });
    }
  })();

  return true;
});

console.debug('[Javis] service worker ready');
