// open_tab.js - Service Worker 中執行的技能
// 此文件直接在 service-worker 中呼叫，無需在網頁前端注入

async function runOpenTabSkill(args) {
    console.log("[Open Tab Skill] 啟動，接收到參數:", args);

    try {
        const url = args.url;
        
        if (!url) {
            throw new Error("未提供 URL");
        }
        
        // 呼叫 Chrome API 開啟分頁
        const tab = await chrome.tabs.create({ url: url });
        
        console.log("[Open Tab Skill] 成功開啟分頁，ID:", tab.id);
        return `成功開啟分頁 (ID: ${tab.id})：${url}`;
        
    } catch (error) {
        console.error("[Open Tab Skill] 錯誤:", error);
        throw new Error(`開啟分頁失敗：${error.message}`);
    }
}
