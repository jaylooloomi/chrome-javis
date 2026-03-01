// close_all_pages.js - 在 SidePanel 中執行的技能
// 關閉所有瀏覽器標籤頁，並保留一個新的 Google 標籤頁

export async function close_all_pages(args) {
    console.log("[Close All Pages Skill] 啟動，接收到參數:", args);

    try {
        // 1. 查詢所有標籤頁
        const tabs = await chrome.tabs.query({});
        console.log("[Close All Pages Skill] 找到", tabs.length, "個標籤頁");

        // 2. 建立一個新的 Google.com 標籤頁
        console.log("[Close All Pages Skill] 正在建立新的 Google 標籤頁");
        const newTab = await chrome.tabs.create({ url: "https://www.google.com" });
        console.log("[Close All Pages Skill] 新標籤頁建立完成，ID:", newTab.id);

        // 3. 關閉所有其他標籤頁
        const tabsToClose = tabs.filter(tab => tab.id !== newTab.id);
        console.log("[Close All Pages Skill] 即將關閉", tabsToClose.length, "個標籤頁");

        for (const tab of tabsToClose) {
            await chrome.tabs.remove(tab.id);
            console.log("[Close All Pages Skill] 已關閉標籤頁，ID:", tab.id, "URL:", tab.url);
        }

        console.log("[Close All Pages Skill] 操作完成");
        return `✅ 已關閉所有 ${tabsToClose.length} 個標籤頁，並開啟新的 Google 標籤頁`;

    } catch (error) {
        console.error("[Close All Pages Skill] 錯誤:", error);
        throw new Error(`關閉所有頁面失敗：${error.message}`);
    }
}
