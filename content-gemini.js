// content-gemini.js - 在 Gemini 頁面中執行的 content script
// 監聽 storage 變化，自動貼上並按 Enter 發送

console.log("[Gemini Content] Content script 已加載");

// 監聽 storage 變化
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'session' && changes.geminiPendingText) {
        const text = changes.geminiPendingText.newValue;
        console.log("[Gemini Content] 收到待貼文字，長度:", text.length);
        
        // 延遲 1 秒確保頁面完全加載
        setTimeout(() => {
            pasteAndSend(text);
        }, 1000);
    }
});

function pasteAndSend(text) {
    console.log("[Gemini Content] === 開始執行自動貼上 ===");

    try {
        // 1. 尋找輸入框
        let inputElement = 
            document.querySelector('[contenteditable="true"]') ||  
            document.querySelector('[role="textbox"]') ||           
            document.querySelector('textarea');

        if (!inputElement) {
            console.error("[Gemini Content] ❌ 找不到輸入框");
            return;
        }

        console.log("[Gemini Content] ✅ 找到輸入框");

        // 2. 聚焦到輸入框
        inputElement.focus();

        // 3. 貼上文字
        if (inputElement.tagName === 'TEXTAREA') {
            inputElement.value = text;
        } else {
            inputElement.textContent = text;
            inputElement.innerText = text;
        }

        // 4. 觸發事件
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));

        console.log("[Gemini Content] ✅ 文字已貼上");

        // 5. 等待 2 秒後 focus 並按 Enter 發送
        console.log("[Gemini Content] 等待 2 秒鐘讓 Gemini 頁面渲染...");
        setTimeout(() => {
            console.log("[Gemini Content] Focus 到輸入框並按 Enter 發送");
            inputElement.focus();
            
            // 按 Enter
            const enterDownEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true,
                shiftKey: false
            });
            inputElement.dispatchEvent(enterDownEvent);
            console.log("[Gemini Content] ✅ 已觸發 keydown Enter");

            setTimeout(() => {
                const enterUpEvent = new KeyboardEvent('keyup', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                });
                inputElement.dispatchEvent(enterUpEvent);
                console.log("[Gemini Content] ✅ 已觸發 keyup Enter，應該已發送");
            }, 50);
        }, 2000);

    } catch (error) {
        console.error("[Gemini Content] ❌ 錯誤:", error);
    }
}
