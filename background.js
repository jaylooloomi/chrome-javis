// background.js

// 安裝時的初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Background] 擴充功能已安裝");
  // 設定點擊圖示後的行為：直接開啟側邊欄
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

console.log("[Background] OmniAssistant Gateway Ready.");