// open_tab_service.js - 在 sidepanel 上下文中執行的技能
// 此文件由 skills-helper.js 動態加載和執行
// 遵循 README 規範：export async function run(args)

export async function run(args) {
    console.log("[Open Tab Skill] 啟動，接收到參數:", args);

    try {
        const url = args.url;
        
        if (!url) {
            throw new Error("未提供 URL");
        }
        
        // 通過 Chrome API 開啟分頁
        const tab = await chrome.tabs.create({ url: url });
        
        console.log("[Open Tab Skill] 成功開啟分頁，ID:", tab.id);
        return `成功開啟分頁 (ID: ${tab.id})：${url}`;
        
    } catch (error) {
        console.error("[Open Tab Skill] 錯誤:", error);
        throw new Error(`開啟分頁失敗：${error.message}`);
    }
}
