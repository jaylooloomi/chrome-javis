// ask_gemini.js - 在 SidePanel 中執行的技能
// 快速將文字發送到 Google Gemini

export async function ask_gemini(args) {
    console.log("[Ask Gemini Skill] 啟動，接收到參數:", args);

    try {
        let text = args.text;
        
        if (!text) {
            throw new Error("未提供查詢文字");
        }

        // 1. 存儲文字到 chrome.storage，供後續使用
        await chrome.storage.session.set({
            geminiPendingText: text,
            geminiTimestamp: Date.now()
        });
        console.log("[Ask Gemini Skill] 已存儲文字到 session storage");

        // 2. 開啟 Gemini 分頁
        const tab = await chrome.tabs.create({ 
            url: 'https://gemini.google.com/' 
        });
        console.log("[Ask Gemini Skill] 已開啟 Gemini 分頁，ID:", tab.id);

        // 3. 存儲分頁 ID，以便後續可以在該分頁注入腳本操作
        await chrome.storage.session.set({
            geminiTabId: tab.id
        });

        const preview = text.length > 100 ? text.substring(0, 100) + "..." : text;
        return `✅ 已開啟 Gemini 分頁\n\n📝 待查詢內容：\n${preview}`;
        
    } catch (error) {
        console.error("[Ask Gemini Skill] 錯誤:", error);
        throw new Error(`Ask Gemini 失敗：${error.message}`);
    }
}
