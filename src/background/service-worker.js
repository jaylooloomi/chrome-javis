// Service worker — opens the side panel and handles the fill keyboard shortcut.

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
});

// Keyboard shortcut (Alt+Shift+F): open the side panel and flag a pending fill,
// which the side panel picks up on load and runs.
chrome.commands?.onCommand.addListener(async (command) => {
  if (command !== 'fill-form') return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    await chrome.storage.local.set({ 'snapfill.pendingFill': true });
    if (chrome.sidePanel?.open) await chrome.sidePanel.open({ tabId: tab.id });
  } catch (err) {
    console.debug('[Snapfill] fill-form command failed:', err);
  }
});

console.debug('[Snapfill] service worker ready');
