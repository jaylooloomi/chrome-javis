// open_tab.js - 在網頁前端執行的技能
// 註：此文件通過 chrome.scripting.executeScript 注入到網頁前端

console.log("[Open Tab Skill] 腳本已注入");

// 定義技能的運行函數
async function runOpenTabSkill(args) {
    console.log("[Open Tab Skill] 啟動，接收到參數:", args);

    try {
        // URL 已經由 service-worker 嚴格驗證，直接使用
        const url = args.url;
        
        if (!url) {
            throw new Error("未提供 URL");
        }
        
        // 呼叫 Chrome API 開啟分頁
        // 注意：在網頁前端環境中，需要通過 chrome.runtime.sendMessage 調用 service-worker 的 API
        // 但 open_tab 實際上需要在 service-worker 中執行（因為需要 tabs.create 權限）
        // 所以這裡回傳訊息給 service-worker，由它來執行
        const result = await chrome.runtime.sendMessage({
            action: "execute_chrome_api",
            apiCall: "tabs.create",
            params: { url: url }
        });
        
        console.log("[Open Tab Skill] 成功開啟分頁，結果:", result);
        return `成功開啟分頁：${url}`;
        
    } catch (error) {
        console.error("[Open Tab Skill] 錯誤:", error);
        throw new Error(`開啟分頁失敗：${error.message}`);
    }
}

// 監聽來自 service-worker 的訊息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Open Tab Skill] 收到訊息:", request);
    
    if (request.action === "run_skill" && request.skillName === "open_tab") {
        runOpenTabSkill(request.args)
            .then(result => {
                sendResponse({ status: "success", result: result });
            })
            .catch(error => {
                sendResponse({ status: "error", error: error.message });
            });
        
        return true; // 表示非同步回應
    }
});