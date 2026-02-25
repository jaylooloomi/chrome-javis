// open_tab.js - 在 SidePanel 中執行的技能
// 標準 ES Module 導出，支援動態 import

export async function open_tab(args) {
    console.log("[Open Tab Skill] 啟動，接收到參數:", args);

    try {
        let url = args.url;
        
        if (!url) {
            throw new Error("未提供 URL");
        }

        // 簡單的 URL 驗證和轉換
        // 如果不是以 http://, https://, 或 chrome-extension:// 開頭，則視為網站名稱，轉換為完整 URL
        if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('chrome-extension://')) {
            // 特殊網站轉換
            if (url.toLowerCase() === 'gmail') {
                url = 'https://mail.google.com';
            } else if (url.toLowerCase() === 'setting') {
                url = 'chrome-extension://llffkjaidimijhnkgpacebjkiicccaaj/options.html';
            } else if (!url.includes('.')) {
                // 如果沒有點號，自動加上 .com
                url = `https://${url}.com`;
            } else {
                // 如果有點號，直接加上 https://
                url = `https://${url}`;
            }
            console.log("[Open Tab Skill] URL 已轉換:", url);
        }
        
        // 驗證 URL 格式 (chrome-extension:// URL 可能無法被 URL() 構造函數驗證)
        if (!url.startsWith('chrome-extension://')) {
            try {
                new URL(url);
            } catch (e) {
                throw new Error(`無效的 URL 格式: ${url}`);
            }
        }
        
        // 通過 Chrome API 開啟分頁
        const tab = await chrome.tabs.create({ url: url });
        
        console.log("[Open Tab Skill] 成功開啟分頁，ID:", tab.id);
        return `✅ 成功開啟分頁：${url}`;
        
    } catch (error) {
        console.error("[Open Tab Skill] 錯誤:", error);
        throw new Error(`開啟分頁失敗：${error.message}`);
    }
}
