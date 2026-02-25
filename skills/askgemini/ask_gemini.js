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
    
    try {
        result.logs.push("=== 開始執行 pasteAndSubmit ===");
        result.logs.push("文字長度: " + text.length);
        
        // 0.5. 首先檢查頁面整體狀態
        result.logs.push("📍 檢查頁面狀態...");
        result.logs.push("  document.readyState: " + document.readyState);
        result.logs.push("  body 中的元素數: " + document.body.children.length);
        
        // 檢查是否找到 input-area 容器
        const inputAreaContainer = document.querySelector('input-area-v2, [data-node-type="input-area"]');
        if (inputAreaContainer) {
            result.logs.push("✅ 找到 input-area 容器");
        } else {
            result.logs.push("⚠️  未找到 input-area 容器 - 頁面可能未完全載入");
        }
        
        // 1. 尋找輸入框 - Gemini 使用 Quill 編輯器
        result.logs.push("正在尋找輸入框...");
        let inputElement = 
            document.querySelector('[contenteditable="true"]') ||  
            document.querySelector('[role="textbox"]') ||           
            document.querySelector('textarea');

        if (!inputElement) {
            result.error = "找不到聊天輸入框";
            result.logs.push("❌ " + result.error);
            return result;
        }

        result.logs.push("✅ 找到輸入框: " + inputElement.tagName + " class=" + inputElement.className);

        // 2. 聚焦並貼上文字
        inputElement.focus();
        result.logs.push("✅ 已 focus 到輸入框");

        // 對於 contenteditable 元素，設置內容並觸發事件
        if (inputElement.contentEditable === 'true') {
            // 清空現有內容
            inputElement.innerHTML = '';
            
            // 設置文本
            const paragraph = document.createElement('p');
            paragraph.textContent = text;
            inputElement.appendChild(paragraph);
            
            result.logs.push("✅ 文字已設置到 contenteditable");
        } else if (inputElement.tagName === 'TEXTAREA') {
            inputElement.value = text;
            result.logs.push("✅ 文字已設置到 textarea");
        } else {
            inputElement.textContent = text;
            result.logs.push("✅ 文字已設置到 textbox");
        }

        // 3. 多次觸發事件以確保 Angular 檢測到變化
        const events = [
            new Event('input', { bubbles: true, cancelable: true }),
            new Event('change', { bubbles: true, cancelable: true }),
            new Event('blur', { bubbles: true, cancelable: true }),
            new KeyboardEvent('keyup', { bubbles: true, cancelable: true })
        ];
        
        events.forEach(evt => {
            inputElement.dispatchEvent(evt);
        });
        
        result.logs.push("✅ 已觸發 input/change/blur/keyup 事件");
        
        // 檢查輸入框是否真的有內容
        const contentLength = inputElement.textContent ? inputElement.textContent.trim().length : 0;
        result.logs.push("📍 輸入框內容長度: " + contentLength);
        
        if (contentLength === 0) {
            result.logs.push("⚠️  警告：輸入框仍為空，文本可能未成功設置");
        }
        
        // 3.5. 等待頁面完全載入和 UI 更新（2000ms，增加等待時間）
        result.logs.push("⏱️ 等待頁面 UI 更新...");
        const startTime = Date.now();
        while (Date.now() - startTime < 2000) {
            // 同步等待 2000ms

        }
        result.logs.push("✅ 頁面 UI 已更新");

        // 4. 立即尋找並點擊發送按鈕
        result.logs.push("正在尋找發送按鈕...");
        
        let sendButton = null;
        
        // 方法1：直接用 class 名稱查找（最可靠）
        sendButton = document.querySelector('button.send-button');
        if (sendButton) {
            result.logs.push("✅ 用 'button.send-button' 找到發送按鈕");
        }
        
        // 方法2：如果方法1失敗，尋找所有按鈕並檢查特徵
        if (!sendButton) {
            const allButtons = document.querySelectorAll('button');
            result.logs.push("📍 開始搜尋，頁面有 " + allButtons.length + " 個 button");
            
            for (let btn of allButtons) {
                const ariaLabel = btn.getAttribute('aria-label') || '';
                const dataTestId = btn.getAttribute('data-testid') || '';
                const className = btn.className || '';
                const innerHTML = btn.innerHTML || '';
                
                // 檢查 className 是否包含 send-button
                if (className.includes('send-button')) {
                    sendButton = btn;
                    result.logs.push("✅ 用 className 找到發送按鈕");
                    result.logs.push("   className: " + className);
                    break;
                }
                
                // 檢查是否包含 send-button-icon 圖標
                if (innerHTML.includes('send-button-icon')) {
                    sendButton = btn;
                    result.logs.push("✅ 用 send-button-icon 找到發送按鈕");
                    result.logs.push("   className: " + className);
                    break;
                }
                
                // 檢查 aria-label 或 data-testid
                if (ariaLabel.toLowerCase().includes('send') ||
                    dataTestId.toLowerCase().includes('send')) {
                    sendButton = btn;
                    result.logs.push("✅ 用 aria-label/data-testid 找到發送按鈕");
                    result.logs.push("   aria-label: " + ariaLabel);
                    result.logs.push("   data-testid: " + dataTestId);
                    break;
                }
            }
        }
        
        // 如果還是沒找到，列出所有 buttons 以供調試
        if (!sendButton) {
            result.logs.push("❌ 未找到發送按鈕，列出所有 buttons 的詳細資訊:");
            const allButtons = document.querySelectorAll('button');
            allButtons.forEach((btn, idx) => {
                const label = btn.getAttribute('aria-label') || '(無)';
                const testId = btn.getAttribute('data-testid') || '(無)';
                const classes = btn.className || '(無)';
                const isDisabled = btn.disabled ? '🔴 DISABLED' : '🟢 ENABLED';
                result.logs.push("  [" + idx + "] " + isDisabled);
                result.logs.push("        classes=" + classes);
                result.logs.push("        aria-label=" + label + " | data-testid=" + testId);
            });
        }
        
        if (sendButton) {
            try {
                // 方法1：直接 click()
                sendButton.click();
                result.logs.push("✅ 已點擊發送按鈕 (方法1: .click())");
                
                // 方法2：觸發 mousedown, mouseup, click 事件
                sendButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                sendButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                result.logs.push("✅ 已觸發 mousedown/mouseup 事件");
                
                // 方法3：焦點 + Enter 鍵
                sendButton.focus();
                sendButton.dispatchEvent(new KeyboardEvent('keydown', { 
                    key: 'Enter', 
                    code: 'Enter', 
                    keyCode: 13,
                    bubbles: true 
                }));
                result.logs.push("✅ 已觸發焦點和 Enter 鍵事件");
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
