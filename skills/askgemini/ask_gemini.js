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
            const scriptResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: pasteAndSubmit,
                args: [text]
            });
            console.log("[Ask Gemini Skill] 自動貼上腳本已執行，結果:", scriptResults);
        } catch (error) {
            console.warn("[Ask Gemini Skill] 自動貼上失敗（可能頁面尚未完全加載或 CSP 限制）:", error);
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
    console.log("[Gemini Content] === 開始執行 pasteAndSubmit ===");
    console.log("[Gemini Content] 文字內容:", text.substring(0, 100));
    
    try {
        // 1. 嘗試尋找不同的聊天輸入框選擇器
        console.log("[Gemini Content] 正在尋找輸入框...");
        let inputElement = 
            document.querySelector('[contenteditable="true"]') ||  
            document.querySelector('[role="textbox"]') ||           
            document.querySelector('textarea') ||
            document.querySelector('[data-testid*="input"]') ||
            document.querySelector('[data-testid*="chat"]');

        if (!inputElement) {
            console.error("[Gemini Content] ❌ 找不到聊天輸入框");
            // 嘗試列出所有可疑的元素
            const allEditable = document.querySelectorAll('[contenteditable]');
            console.log("[Gemini Content] 找到 contenteditable 元素數量:", allEditable.length);
            allEditable.forEach((el, idx) => {
                console.log(`[Gemini Content] 元素 ${idx}:`, el.tagName, el.className, el.contentEditable);
            });
            return { success: false, error: "找不到輸入框" };
        }

        console.log("[Gemini Content] ✅ 找到輸入框");
        console.log("[Gemini Content] 輸入框標籤:", inputElement.tagName);
        console.log("[Gemini Content] 輸入框類別:", inputElement.className);
        console.log("[Gemini Content] contentEditable:", inputElement.contentEditable);

        // 2. 設置文字內容
        console.log("[Gemini Content] 正在設置文字內容...");
        if (inputElement.tagName === 'TEXTAREA') {
            console.log("[Gemini Content] 使用 TEXTAREA 模式");
            inputElement.value = text;
            inputElement.textContent = text;
        } else if (inputElement.contentEditable === 'true' || inputElement.getAttribute('contenteditable') === 'true') {
            console.log("[Gemini Content] 使用 contentEditable 模式");
            inputElement.textContent = text;
            inputElement.innerText = text;
            
            // 也嘗試設置 innerHTML
            const div = document.createElement('div');
            div.textContent = text;
            inputElement.innerHTML = div.innerHTML;
        } else {
            console.log("[Gemini Content] 使用通用模式");
            inputElement.textContent = text;
            inputElement.value = text;
            if (inputElement.innerText !== undefined) {
                inputElement.innerText = text;
            }
        }

        console.log("[Gemini Content] ✅ 文字已設置");

        // 3. 觸發各種事件讓 Gemini 偵測到
        console.log("[Gemini Content] 正在觸發事件...");
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        inputElement.dispatchEvent(new Event('blur', { bubbles: true }));
        inputElement.dispatchEvent(new Event('focus', { bubbles: true }));

        // 4. 等待 2 秒後 focus 並按 Enter 發送
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
        console.error("[Gemini Content] ❌ 異常:", error);
        console.error("[Gemini Content] 錯誤堆棧:", error.stack);
        return { success: false, error: error.message };
    }
}
