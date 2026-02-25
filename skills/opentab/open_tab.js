export async function run(args) {
    console.log("[Open Tab Skill] 啟動，接收到參數:", args);

    try {
        // URL 已經由 service-worker 嚴格驗證，直接使用
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
        return `開啟分頁失敗：${error.message}`;
    }
}