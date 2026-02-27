// ========= 頁面區域 - 麥克風權限控制 =========
document.getElementById('requestMicBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = '';
    statusDiv.className = '';
    
    try {
        console.log("[Options] 正在請求麥克風權限...");
        statusDiv.textContent = '正在請求麥克風權限...';
        statusDiv.className = 'status pending';
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        console.log("[Options] 麥克風權限已授予");
        statusDiv.textContent = '✅ 麥克風權限已成功授予！您現在可以在 Side Panel 中使用語音輸入功能。';
        statusDiv.className = 'status success';
        
        stream.getTracks().forEach(track => track.stop());
        
    } catch (error) {
        console.error("[Options] 麥克風權限被拒絕:", error);
        
        let errorMsg = error.name;
        if (error.name === 'NotAllowedError') {
            errorMsg = '您拒絕了麥克風許可權限';
        } else if (error.name === 'NotFoundError') {
            errorMsg = '未找到麥克風設備';
        } else if (error.name === 'NotReadableError') {
            errorMsg = '麥克風被其他程式佔用';
        }
        
        statusDiv.textContent = `❌ 麥克風權限授予失敗: ${errorMsg}`;
        statusDiv.className = 'status error';
    }
});

// ========= 通知設定 =========
const notificationToggle = document.getElementById('notificationToggle');
const notificationLabel = document.getElementById('notificationLabel');

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 通知設定不敏感，維持 storage.local（不需要 sync）
        const settings = await chrome.storage.local.get('notificationsEnabled');
        const isEnabled = settings.notificationsEnabled !== false;
        updateNotificationUI(isEnabled);
    } catch (error) {
        console.error('[Options] 讀取通知設定失敗:', error);
    }
});

notificationToggle.addEventListener('click', async () => {
    try {
        const isCurrentlyActive = notificationToggle.classList.contains('active');
        const newState = !isCurrentlyActive;
        await chrome.storage.local.set({ notificationsEnabled: newState });
        updateNotificationUI(newState);
        console.log('[Options] 通知設定已更新:', newState);
    } catch (error) {
        console.error('[Options] 保存通知設定失敗:', error);
    }
});

function updateNotificationUI(isEnabled) {
    if (isEnabled) {
        notificationToggle.classList.add('active');
        notificationLabel.textContent = '通知已啟用';
    } else {
        notificationToggle.classList.remove('active');
        notificationLabel.textContent = '通知已停用';
    }
}

// ========= Gemini API Key 設定區域（settings.html）=========
const geminiApiKeyInput = document.getElementById('geminiApiKey');
const geminiSaveBtn = document.getElementById('saveGeminiKeyBtn');
const geminiStatusDiv = document.getElementById('geminiKeyStatus');

// 只在 settings.html 中綁定事件（有 geminiSaveBtn 時）
if (geminiSaveBtn) {
    // 頁面加載時載入 API Key（優先級：1. storage.local 2. config.json）
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            // 優先從 storage.local 讀取已儲存的 API Key
            const result = await chrome.storage.local.get('geminiApiKey');
            if (result.geminiApiKey) {
                geminiApiKeyInput.value = result.geminiApiKey;
                showGeminiStatus('✅ 已載入儲存的 API Key', 'success');
                return;
            }
            
            // 如果 storage.local 沒有，則從 config.json 讀取
            console.log('[Settings] 從 config.json 載入 API Key...');
            const configUrl = chrome.runtime.getURL('config.json');
            const configResponse = await fetch(configUrl);
            const configData = await configResponse.json();
            
            if (configData.geminiFlash && configData.geminiFlash.apiKey) {
                const apiKeyFromConfig = configData.geminiFlash.apiKey;
                geminiApiKeyInput.value = apiKeyFromConfig;
                console.log('[Settings] 已從 config.json 載入 API Key');
            }
        } catch (error) {
            console.error('[Settings] 讀取 API Key 失敗:', error);
        }
    });

    // 儲存按鈕 - 存入 storage.local
    geminiSaveBtn.addEventListener('click', async () => {
        const apiKey = geminiApiKeyInput.value.trim();
        
        if (!apiKey) {
            showGeminiStatus('❌ 請輸入有效的 API Key', 'error');
            return;
        }

        // 基本格式驗證（Google API Key 以 AIzaSy 開頭）
        if (!apiKey.startsWith('AIzaSy') || apiKey.length < 35) {
            showGeminiStatus('❌ API Key 格式不正確，請確認是否為有效的 Gemini API Key', 'error');
            return;
        }
        
        try {
            // 存入 chrome.storage.local（明文，因為需要在 service-worker 中直接讀取）
            await chrome.storage.local.set({ geminiApiKey: apiKey });
            showGeminiStatus('✅ API Key 已儲存！', 'success');
            console.log('[Settings] Gemini API Key 已儲存');
        } catch (error) {
            console.error('[Settings] 儲存 API Key 失敗:', error);
            showGeminiStatus('❌ 儲存失敗，請稍後再試', 'error');
        }
    });
    
    // 顯示狀態消息的輔助函數
    function showGeminiStatus(message, type) {
        geminiStatusDiv.textContent = message;
        geminiStatusDiv.className = `status ${type}`;
        geminiStatusDiv.style.display = 'block';
        
        if (type === 'success') {
            setTimeout(() => { geminiStatusDiv.style.display = 'none'; }, 3000);
        }
    }
}

// ========= API Key 設定區域（加密版） =========
// 只在 options.html 中執行（settings.html 中不存在這些元素）
const apiKeyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveApiKeyBtn');
const statusDiv = document.getElementById('apiKeyStatus');
const toggleVisibilityBtn = document.getElementById('toggleApiKeyVisibility');

// 只在 options.html 中綁定事件（有這些元素時）
if (apiKeyInput && toggleVisibilityBtn && saveBtn) {
    // 頁面加載時檢查 API Key 狀態
    document.addEventListener('DOMContentLoaded', updateConfigStatus);

    // 顯示/隱藏 API Key 切換
    toggleVisibilityBtn.addEventListener('click', () => {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            toggleVisibilityBtn.textContent = '🙈 隱藏';
        } else {
            apiKeyInput.type = 'password';
            toggleVisibilityBtn.textContent = '👁 顯示';
        }
    });

    // 儲存按鈕 - 加密後存入 storage.local
    saveBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            statusDiv.textContent = '❌ 請輸入有效的 API Key';
            statusDiv.className = 'status error';
            return;
        }

        // 基本格式驗證（Google API Key 以 AIzaSy 開頭）
        if (!apiKey.startsWith('AIzaSy') || apiKey.length < 35) {
            statusDiv.textContent = '❌ API Key 格式不正確，請確認是否為有效的 Gemini API Key';
            statusDiv.className = 'status error';
            return;
        }
        
        try {
            // 加密後存入 chrome.storage.local（不 sync 到其他裝置）
            const encrypted = await encryptApiKey(apiKey);
            await chrome.storage.local.set({ geminiApiKeyEncrypted: encrypted });

            // 確保舊的明文 sync key 被清除
            await chrome.storage.sync.remove('geminiApiKey');
            
            statusDiv.textContent = '✅ API Key 已加密儲存於本機！';
            statusDiv.className = 'status success';
            
            apiKeyInput.value = '';
            apiKeyInput.type = 'password';
            toggleVisibilityBtn.textContent = '👁 顯示';
            
            updateConfigStatus();
        } catch (error) {
            console.error('[Options] 儲存 API Key 時出錯:', error);
            statusDiv.textContent = '❌ 儲存失敗，請稍後再試';
            statusDiv.className = 'status error';
        }
    });

    // 刪除 API Key
    document.getElementById('deleteApiKeyBtn').addEventListener('click', async () => {
        if (!confirm('確定要刪除已儲存的 API Key 嗎？')) return;
        try {
            await chrome.storage.local.remove(['geminiApiKeyEncrypted', 'javis_enc_key']);
            await chrome.storage.sync.remove('geminiApiKey'); // 清除舊版明文
            updateConfigStatus();
            statusDiv.textContent = '✅ API Key 已刪除';
            statusDiv.className = 'status success';
        } catch (error) {
            console.error('[Options] 刪除 API Key 失敗:', error);
        }
    });
}

// 更新 API Key 配置狀態顯示
async function updateConfigStatus() {
    // 只在有 configStatus 元素時執行（即 options.html 中）
    const configStatus = document.getElementById('configStatus');
    if (!configStatus) {
        console.log('[Settings] configStatus 元素不存在，跳過更新');
        return;
    }
    
    try {
        const result = await chrome.storage.local.get('geminiApiKeyEncrypted');
        
        if (!result.geminiApiKeyEncrypted) {
            // 檢查是否有舊版明文 key，提示遷移
            const oldResult = await chrome.storage.sync.get('geminiApiKey');
            if (oldResult.geminiApiKey) {
                configStatus.innerHTML = `
                    ⚠️ 偵測到舊版未加密的 API Key<br>
                    <small style="color: #856404;">請重新輸入您的 API Key 以升級為加密儲存</small>
                `;
                configStatus.className = 'status warning';
            } else {
                configStatus.innerHTML = `
                    ❌ 尚未設定 API Key<br>
                    <small style="color: #666;">請在下方輸入您的 Gemini API Key</small>
                `;
                configStatus.className = 'status error';
            }
        } else {
            // 解密後只顯示遮罩（前4碼 + 後4碼）
            try {
                const decrypted = await decryptApiKey(result.geminiApiKeyEncrypted);
                const masked = maskApiKey(decrypted);
                configStatus.innerHTML = `
                    ✅ 已設定 API Key（加密儲存於本機）<br>
                    <small style="color: #666; font-family: monospace;">金鑰: ${masked}</small>
                `;
            } catch {
                configStatus.innerHTML = `✅ 已設定 API Key（加密儲存於本機）`;
            }
            configStatus.className = 'status success';
        }
    } catch (error) {
        console.error('[Settings] 檢查配置時出錯:', error);
    }
}

// ========= 麥克風語言設定 =========
let micLangSelect;
let activeModelSelect;

document.addEventListener('DOMContentLoaded', async () => {
    // 麥克風語言選擇器
    micLangSelect = document.getElementById('micLanguage');
    if (!micLangSelect) {
        console.error('[Settings] 找不到麥克風語言選擇器');
    } else {
        try {
            const result = await chrome.storage.local.get('micLanguage');
            const language = result.micLanguage || 'zh-TW';
            micLangSelect.value = language;
            console.log('[Settings] 麥克風語言設定已載入:', language);
        } catch (error) {
            console.error('[Settings] 讀取麥克風語言設定失敗:', error);
        }
        
        // 綁定改動事件
        micLangSelect.addEventListener('change', async () => {
            try {
                const language = micLangSelect.value;
                await chrome.storage.local.set({ micLanguage: language });
                console.log('[Settings] 麥克風語言設定已更新:', language);
                // ✅ 存儲改變會觸發 sidepanel.js 中的 chrome.storage.onChanged 監聽器
                
                const langStatus = document.getElementById('langStatus') || document.createElement('div');
                langStatus.id = 'langStatus';
                langStatus.textContent = '✅ 語言設定已儲存';
                langStatus.className = 'status success';
                langStatus.style.marginTop = '10px';
                langStatus.style.display = 'block';
                
                if (!document.getElementById('langStatus')) {
                    micLangSelect.parentElement.appendChild(langStatus);
                }
                
                setTimeout(() => { langStatus.style.display = 'none'; }, 3000);
            } catch (error) {
                console.error('[Settings] 保存麥克風語言設定失敗:', error);
            }
        });
    }

    // ========= AI 模型選擇 =========
    activeModelSelect = document.getElementById('activeModel');
    if (!activeModelSelect) {
        console.error('[Settings] 找不到 AI 模型選擇器');
    } else {
        try {
            const result = await chrome.storage.local.get('activeModel');
            const model = result.activeModel || 'geminiFlash';
            activeModelSelect.value = model;
            console.log('[Settings] AI 模型設定已載入:', model);
        } catch (error) {
            console.error('[Settings] 讀取 AI 模型設定失敗:', error);
        }
        
        // 綁定改動事件
        activeModelSelect.addEventListener('change', async () => {
            try {
                const model = activeModelSelect.value;
                await chrome.storage.local.set({ activeModel: model });
                console.log('[Settings] AI 模型設定已更新:', model);
                
                const modelStatus = document.getElementById('modelStatus') || document.createElement('div');
                modelStatus.id = 'modelStatus';
                modelStatus.textContent = '✅ 模型設定已儲存（需重新啟動擴展程式才能生效）';
                modelStatus.className = 'status success';
                modelStatus.style.marginTop = '10px';
                modelStatus.style.display = 'block';
                
                if (!document.getElementById('modelStatus')) {
                    activeModelSelect.parentElement.appendChild(modelStatus);
                }
                
                setTimeout(() => { modelStatus.style.display = 'none'; }, 5000);
            } catch (error) {
                console.error('[Settings] 保存 AI 模型設定失敗:', error);
            }
        });
    }
});
