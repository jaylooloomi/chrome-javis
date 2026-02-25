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
    const result = { success: false, logs: [], error: null };
    
    try {
        result.logs.push("=== 開始執行 pasteAndSubmit ===");
        result.logs.push("文字長度: " + text.length);
        
        // 1. 尋找輸入框
        result.logs.push("正在尋找輸入框...");
        let inputElement = 
            document.querySelector('[contenteditable="true"]') ||  
            document.querySelector('[role="textbox"]') ||           
            document.querySelector('textarea') ||
            document.querySelector('[data-testid*="input"]') ||
            document.querySelector('[data-testid*="chat"]');

        if (!inputElement) {
            result.error = "找不到聊天輸入框";
            result.logs.push("❌ " + result.error);
            return result;
        }

        result.logs.push("✅ 找到輸入框: " + inputElement.tagName + " - " + inputElement.className);

        // 2. 聚焦並貼上文字
        inputElement.focus();
        result.logs.push("✅ 已 focus 到輸入框");

        if (inputElement.tagName === 'TEXTAREA') {
            inputElement.value = text;
        } else {
            inputElement.textContent = text;
            inputElement.innerText = text;
        }
        result.logs.push("✅ 文字已設置");

        // 3. 觸發事件
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        result.logs.push("✅ 事件已觸發");
        
        // 3. 觸發事件
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        result.logs.push("✅ 事件已觸發");
        
        // 3.5. 等待頁面完全載入和 UI 更新（1500ms）
        result.logs.push("⏱️ 等待頁面 UI 更新...");
        const startTime = Date.now();
        while (Date.now() - startTime < 1500) {
            // 同步等待 1500ms
        }
        result.logs.push("✅ 頁面 UI 已更新");

        // 4. 立即尋找並點擊發送按鈕
        result.logs.push("正在尋找發送按鈕...");
        
        let sendButton = null;
        
        // 方法：尋找所有按鈕，根據特徵找到發送按鈕
        const allButtons = document.querySelectorAll('button');
        result.logs.push("📍 開始搜尋，頁面有 " + allButtons.length + " 個 button");
        
        for (let btn of allButtons) {
            const ariaLabel = btn.getAttribute('aria-label') || '';
            const dataTestId = btn.getAttribute('data-testid') || '';
            const className = btn.className || '';
            const innerHTML = btn.innerHTML || '';
            
            // 檢查是否包含 send-button-icon
            if (innerHTML.includes('send-button-icon') || 
                ariaLabel.toLowerCase().includes('send') ||
                dataTestId.includes('send')) {
                sendButton = btn;
                result.logs.push("✅ 找到發送按鈕");
                result.logs.push("   aria-label: " + ariaLabel);
                result.logs.push("   data-testid: " + dataTestId);
                result.logs.push("   className: " + className);
                break;
            }
        }
        
        // 如果還是沒找到，列出所有 buttons 以供調試
        if (!sendButton) {
            result.logs.push("❌ 透過特徵未找到發送按鈕，列出所有 buttons:");
            allButtons.forEach((btn, idx) => {
                const label = btn.getAttribute('aria-label') || '(無)';
                const testId = btn.getAttribute('data-testid') || '(無)';
                result.logs.push("  [" + idx + "] aria-label=" + label + " | data-testid=" + testId);
            });
        }
        
        if (sendButton) {
            try {
                sendButton.click();
                result.logs.push("✅ 已點擊發送按鈕");
            } catch (e) {
                result.logs.push("❌ 點擊發送按鈕失敗: " + e);
                throw new Error("無法點擊發送按鈕: " + e.message);
            }
        } else {
            // 詳細的調試信息
            result.logs.push("❌ 找不到發送按鈕");
            
            // 列出頁面所有 button
            const allButtons = document.querySelectorAll('button');
            result.logs.push("📋 頁面中共有 " + allButtons.length + " 個 button：");
            allButtons.forEach((btn, idx) => {
                const label = btn.getAttribute('aria-label') || btn.textContent?.substring(0, 30) || '(無標籤)';
                result.logs.push("  [" + idx + "] " + btn.className + " - " + label);
            });
            
            // 列出所有 mat-icon
            const allIcons = document.querySelectorAll('mat-icon');
            result.logs.push("📋 頁面中共有 " + allIcons.length + " 個 mat-icon");
            if (allIcons.length > 0) {
                allIcons.forEach((icon, idx) => {
                    const name = icon.getAttribute('data-mat-icon-name') || icon.textContent?.substring(0, 30) || '(無名稱)';
                    result.logs.push("  [" + idx + "] data-mat-icon-name=" + name);
                });
            }
            
            throw new Error("無法找到 Gemini 發送按鈕，詳見上方日誌。頁面可能未完全載入或 UI 結構已改變");
        }

        result.success = true;
        result.logs.push("✅ 流程已完成");
        return result;

    } catch (error) {
        result.error = error.toString();
        result.logs.push("❌ 異常: " + error);
        return result;
    }
}
