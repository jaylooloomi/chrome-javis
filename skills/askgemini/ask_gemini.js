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
            
            // 詳細輸出結果
            if (scriptResults && scriptResults.length > 0) {
                const result = scriptResults[0].result;
                console.log("[Ask Gemini Skill] 腳本執行結果:", result);
                
                if (result && result.logs) {
                    console.log("[Ask Gemini Skill] 詳細日誌:");
                    result.logs.forEach(log => {
                        console.log("[Ask Gemini Skill]   " + log);
                    });
                }
                
                if (result && result.error) {
                    console.warn("[Ask Gemini Skill] 執行時發生錯誤: " + result.error);
                }
            }
        } catch (error) {
            console.warn("[Ask Gemini Skill] executeScript 失敗:", error);
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
async function waitForPageLoad(tabId, maxAttempts = 20, delayMs = 500) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            // 嘗試檢查頁面中是否存在聊天輸入框和 input-area 容器
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                function: () => {
                    // 檢查 input-area 容器是否存在（這是關鍵）
                    const hasInputArea = !!(
                        document.querySelector('input-area-v2') ||
                        document.querySelector('[data-node-type="input-area"]')
                    );
                    
                    // 同時檢查輸入框
                    const hasInputElement = !!(
                        document.querySelector('[contenteditable="true"]') ||
                        document.querySelector('[role="textbox"]') ||
                        document.querySelector('textarea')
                    );
                    
                    return hasInputArea && hasInputElement;
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
    const result = { success: false, logs: [], error: null };
    const startTime = Date.now();
    
    try {
        result.logs.push("[+0ms] === 開始執行 pasteAndSubmit ===");
        result.logs.push("[+0ms] 文字長度: " + text.length);
        
        // 0.5. 首先檢查頁面整體狀態
        result.logs.push("[+" + (Date.now() - startTime) + "ms] 📍 檢查頁面狀態...");
        result.logs.push("[+" + (Date.now() - startTime) + "ms]   document.readyState: " + document.readyState);
        result.logs.push("[+" + (Date.now() - startTime) + "ms]   body 中的元素數: " + document.body.children.length);
        
        // 檢查是否找到 input-area 容器
        const inputAreaContainer = document.querySelector('input-area-v2, [data-node-type="input-area"]');
        if (inputAreaContainer) {
            result.logs.push("[+" + (Date.now() - startTime) + "ms] ✅ 找到 input-area 容器");
        } else {
            result.logs.push("[+" + (Date.now() - startTime) + "ms] ⚠️  未找到 input-area 容器 - 頁面可能未完全載入");
        }
        
        // 1. 尋找輸入框 - Gemini 使用 Quill 編輯器
        result.logs.push("[+" + (Date.now() - startTime) + "ms] 正在尋找輸入框...");
        let inputElement = 
            document.querySelector('[contenteditable="true"]') ||  
            document.querySelector('[role="textbox"]') ||           
            document.querySelector('textarea');

        if (!inputElement) {
            result.error = "找不到聊天輸入框";
            result.logs.push("[+" + (Date.now() - startTime) + "ms] ❌ " + result.error);
            return result;
        }

        result.logs.push("[+" + (Date.now() - startTime) + "ms] ✅ 找到輸入框: " + inputElement.tagName + " class=" + inputElement.className);

        // 2. 聚焦並貼上文字
        inputElement.focus();
        result.logs.push("[+" + (Date.now() - startTime) + "ms] ✅ 已 focus 到輸入框");

        // 對於 contenteditable 元素，設置文本內容
        if (inputElement.contentEditable === 'true') {
            // 方法1: 直接設置 textContent
            inputElement.textContent = text;
            
            // 方法2: 也設置 innerText
            inputElement.innerText = text;
            
            result.logs.push("[+" + (Date.now() - startTime) + "ms] ✅ 文字已設置到 contenteditable");
        } else if (inputElement.tagName === 'TEXTAREA') {
            inputElement.value = text;
            result.logs.push("[+" + (Date.now() - startTime) + "ms] ✅ 文字已設置到 textarea");
        } else {
            inputElement.textContent = text;
            inputElement.innerText = text;
            result.logs.push("[+" + (Date.now() - startTime) + "ms] ✅ 文字已設置到 textbox");
        }

        // 3. 觸發所有可能的事件，讓 Angular 和 Quill 檢測到變化
        const events = [
            new Event('input', { bubbles: true, cancelable: true }),
            new Event('change', { bubbles: true, cancelable: true }),
            new Event('blur', { bubbles: true, cancelable: true }),
            new KeyboardEvent('keyup', { bubbles: true, cancelable: true }),
            new KeyboardEvent('keydown', { bubbles: true, cancelable: true }),
            new KeyboardEvent('keypress', { bubbles: true, cancelable: true })
        ];
        
        for (let i = 0; i < 2; i++) {
            events.forEach(evt => {
                inputElement.dispatchEvent(evt);
            });
        }
        
        // 添加 Angular 友好的事件
        inputElement.dispatchEvent(new Event('ngModelChange', { bubbles: true }));
        
        result.logs.push("[+" + (Date.now() - startTime) + "ms] ✅ 已觸發多個事件確保 Angular 檢測到變化");
        result.logs.push("[+" + (Date.now() - startTime) + "ms] 🛑 現在使用 setTimeout 延遲點擊，讓腳本立即返回...");
        result.logs.push("[+" + (Date.now() - startTime) + "ms] ℹ️ 按鈕只會在此腳本完全執行完畢後才啟用");
        
        // 使用 setTimeout 在腳本完成後 2 秒時點擊，這樣 Gemini 不會看到長時間的 DOM 監控
        setTimeout(() => {
            const clickStartTime = Date.now();
            console.log("[Ask Gemini Skill] [延遲點擊] 開始尋找按鈕 (+0ms from setTimeout)...");
            
            // 尋找發送按鈕
            let sendButton = document.querySelector('button.send-button');
            
            if (!sendButton) {
                const allButtons = document.querySelectorAll('button');
                for (let btn of allButtons) {
                    const className = btn.className || '';
                    const innerHTML = btn.innerHTML || '';
                    const ariaLabel = btn.getAttribute('aria-label') || '';
                    const dataTestId = btn.getAttribute('data-testid') || '';
                    
                    if (className.includes('send-button') || 
                        innerHTML.includes('send-button-icon') ||
                        ariaLabel.toLowerCase().includes('send') ||
                        dataTestId.toLowerCase().includes('send')) {
                        sendButton = btn;
                        break;
                    }
                }
            }
            
            if (sendButton) {
                console.log("[Ask Gemini Skill] [延遲點擊] 找到按鈕，狀態: disabled=" + sendButton.disabled + ", aria-disabled=" + sendButton.getAttribute('aria-disabled'));
                console.log("[Ask Gemini Skill] [延遲點擊] 直接點擊按鈕...");
                sendButton.click();
                console.log("[Ask Gemini Skill] [延遲點擊] ✅ 已點擊發送按鈕");
            } else {
                console.warn("[Ask Gemini Skill] [延遲點擊] ❌ 找不到發送按鈕");
            }
        }, 500);  // 0.5 秒後點擊
        
        result.logs.push("[+" + (Date.now() - startTime) + "ms] ✅ 已安排 setTimeout 延遲點擊 (500ms 後)");
        result.logs.push("[+" + (Date.now() - startTime) + "ms] ✅ 流程已完成（腳本立即返回，讓 Gemini 解除按鈕禁用）");

    } catch (error) {
        result.error = error.toString();
        result.logs.push("[+" + (Date.now() - startTime) + "ms] ❌ 異常: " + error);
        return result;
    }
}
