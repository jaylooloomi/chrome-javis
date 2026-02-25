// open_tab.js - 在 Service Worker 中執行的技能
// 全局註冊到 SERVICE_WORKER_SKILLS

console.log("[Open Tab Skill] 技能文件已加載，正在註冊...");

// 確保 SERVICE_WORKER_SKILLS 存在（由 service-worker.js 定義）
if (typeof SERVICE_WORKER_SKILLS !== 'undefined') {
    SERVICE_WORKER_SKILLS['open_tab'] = async (args) => {
        console.log("[Open Tab Skill] 啟動，接收到參數:", args);

        try {
            let url = args.url;
            
            if (!url) {
                throw new Error("未提供 URL");
            }

            // 簡單的 URL 驗證和轉換
            // 如果不是以 http:// 或 https:// 開頭，則視為網站名稱，轉換為完整 URL
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                // 檢查是否包含點號（網域名稱特徵）
                if (!url.includes('.')) {
                    // 如果沒有點號，自動加上 .com
                    url = `https://${url}.com`;
                } else {
                    // 如果有點號，直接加上 https://
                    url = `https://${url}`;
                }
                console.log("[Open Tab Skill] URL 已轉換:", url);
            }
            
            // 驗證 URL 格式
            try {
                new URL(url);
            } catch (e) {
                throw new Error(`無效的 URL 格式: ${url}`);
            }
            
            // 通過 Chrome API 開啟分頁
            const tab = await chrome.tabs.create({ url: url });
            
            console.log("[Open Tab Skill] 成功開啟分頁，ID:", tab.id);
            return `✅ 成功開啟分頁：${url}`;
            
        } catch (error) {
            console.error("[Open Tab Skill] 錯誤:", error);
            throw new Error(`開啟分頁失敗：${error.message}`);
        }
    };
    console.log("[Open Tab Skill] ✅ 已成功註冊到 SERVICE_WORKER_SKILLS");
} else {
    console.error("[Open Tab Skill] ❌ SERVICE_WORKER_SKILLS 未定義！");
}
