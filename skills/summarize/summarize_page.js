/**
 * 總結技能 - 只負責抓取頁面內容
 * Gateway 會負責調用 Gemini Flash 進行 AI 總結
 */
export async function run(args) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            return "❌ 找不到當前分頁";
        }

        // 排除 Chrome 內部頁面
        if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) {
            return "❌ 無法讀取瀏覽器內部頁面";
        }

        console.log("[Skill: summarize_page] 正在抓取頁面內容...");
        
        const injectionResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                return document.body.innerText
                    .replace(/\s+/g, ' ')
                    .substring(0, 8000);
            }
        });

        if (!injectionResults || injectionResults.length === 0) {
            return "❌ 無法注入腳本";
        }

        const pageContent = injectionResults[0].result;

        if (!pageContent || pageContent.length === 0) {
            return "❌ 頁面內容為空";
        }

        console.log("[Skill: summarize_page] ✅ 已抓取", pageContent.length, "個字符");
        
        // 返回一個包含 pageContent 的物件，Gateway 會檢測這個並進行 AI 總結
        return JSON.stringify({
            pageContent: pageContent
        });

    } catch (error) {
        console.error("[Skill: summarize_page] 錯誤:", error);
        return `❌ 執行失敗：${error.message}`;
    }
}