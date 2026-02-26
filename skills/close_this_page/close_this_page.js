// close_this_page.js - 在 SidePanel 中執行的技能
// 關閉當前活動的瀏覽器標籤頁

export async function close_this_page(args) {
    console.log("[Close Page Skill] 啟動，接收到參數:", args);

    try {
        const tabId = args.tabId;
        const url = args.url;
        
        if (!tabId) {
            throw new Error("未提供標籤頁 tabId");
        }

        // 1. 關閉指定的標籤頁
        console.log("[Close Page Skill] 正在關閉 tabId:", tabId, "URL:", url);
        await chrome.tabs.remove(tabId);
        
        console.log("[Close Page Skill] 成功關閉標籤頁，ID:", tabId);
        return `✅ 成功關閉頁面：${url}`;
        
    } catch (error) {
        console.error("[Close Page Skill] 錯誤:", error);
        throw new Error(`關閉頁面失敗：${error.message}`);
    }
}
