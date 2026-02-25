// ask_gemini.js - 在 SidePanel 中執行的技能
// 快速將文字發送到 Google Gemini

export async function ask_gemini(args) {
    console.log("[Ask Gemini Skill] 啟動，接收到參數:", args);

    try {
        let text = args.text;
        
        if (!text) {
            throw new Error("未提供查詢文字");
        }

        // 1. 開啟 Gemini 分頁
        const tab = await chrome.tabs.create({ 
            url: 'https://gemini.google.com/' 
        });
        console.log("[Ask Gemini Skill] 已開啟 Gemini 分頁，ID:", tab.id);

        // 2. 等待頁面加載（重試機制，最多等待 8 秒）
        await waitForPageLoad(tab.id);

        // 3. 在 Gemini 分頁中注入腳本，自動貼上文字並發送
        console.log("[Ask Gemini Skill] 正在注入自動貼上腳本");
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: pasteAndSubmit,
                args: [text]
            });
            console.log("[Ask Gemini Skill] 自動貼上腳本已執行");
        } catch (error) {
            console.warn("[Ask Gemini Skill] 自動貼上失敗（可能頁面尚未完全加載）:", error);
            // 這不是致命錯誤，用戶可以手動貼上
        }

        const preview = text.length > 100 ? text.substring(0, 100) + "..." : text;
        return `✅ 已開啟 Gemini 分頁\n\n📝 待查詢內容：\n${preview}`;
        
    } catch (error) {
        console.error("[Ask Gemini Skill] 錯誤:", error);
        throw new Error(`Ask Gemini 失敗：${error.message}`);
    }
}

/**
 * 等待 Gemini 頁面加載完成
 * 嘗試多次檢查聊天框是否出現
 */
async function waitForPageLoad(tabId, maxAttempts = 16, delayMs = 500) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            // 嘗試檢查頁面中是否存在聊天輸入框
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                function: () => {
                    // 嘗試尋找 Gemini 聊天框（可能的選擇器）
                    return !!(
                        document.querySelector('[contenteditable="true"]') ||
                        document.querySelector('[role="textbox"]') ||
                        document.querySelector('textarea')
                    );
                }
            });

            if (results[0]?.result) {
                console.log(`[Ask Gemini Skill] 頁面加載完成（${i + 1} 次嘗試）`);
                return;
            }
        } catch (error) {
            console.log(`[Ask Gemini Skill] 檢查頁面加載... (${i + 1}/${maxAttempts})`);
        }

        // 等待再重試
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    console.warn("[Ask Gemini Skill] 無法確認頁面已加載，但繼續執行");
}

/**
 * 在 Gemini 頁面中執行：尋找聊天框、貼上文字、發送
 * 這個函數會在 Gemini 頁面的 DOM 上下文中執行
 */
function pasteAndSubmit(text) {
    console.log("[Gemini Content] 開始貼上文字:", text.substring(0, 50));

    try {
        // 1. 嘗試尋找不同的聊天輸入框選擇器
        let inputElement = 
            document.querySelector('[contenteditable="true"]') ||  // Gemini 使用的
            document.querySelector('[role="textbox"]') ||           // 備選
            document.querySelector('textarea');                     // 備選

        if (!inputElement) {
            console.error("[Gemini Content] 找不到聊天輸入框");
            alert("⚠️ 找不到 Gemini 聊天框。請手動貼上文字。");
            return;
        }

        console.log("[Gemini Content] 找到輸入框:", inputElement.tagName);

        // 2. 設置文字內容
        if (inputElement.tagName === 'TEXTAREA') {
            inputElement.value = text;
        } else {
            inputElement.textContent = text;
            inputElement.innerText = text;
        }

        // 3. 觸發 input 事件（讓 Gemini 偵測到用戶輸入）
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));

        console.log("[Gemini Content] 文字已貼上，正在尋找發送按鈕");

        // 4. 尋找並點擊發送按鈕
        const sendButton = 
            document.querySelector('[aria-label*="Send"]') ||           // 英文
            document.querySelector('[aria-label*="send"]') ||           // 小寫
            document.querySelector('[aria-label*="發送"]') ||           // 中文
            document.querySelector('[aria-label*="提交"]') ||           // 中文備選
            Array.from(document.querySelectorAll('button')).find(btn => 
                btn.textContent.includes('Send') || 
                btn.textContent.includes('send') ||
                btn.getAttribute('aria-label')?.includes('send')
            );

        if (sendButton) {
            console.log("[Gemini Content] 找到發送按鈕，點擊");
            sendButton.click();
        } else {
            // 備選：按 Enter 鍵
            console.log("[Gemini Content] 未找到發送按鈕，嘗試按 Enter");
            const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
            });
            inputElement.dispatchEvent(enterEvent);
            
            const enterUpEvent = new KeyboardEvent('keyup', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
            });
            inputElement.dispatchEvent(enterUpEvent);
        }

        console.log("[Gemini Content] ✅ 文字已發送");

    } catch (error) {
        console.error("[Gemini Content] 貼上失敗:", error);
        alert(`❌ 自動貼上失敗：${error.message}。請手動貼上。`);
    }
}
