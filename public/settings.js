// ========= i18n 初始化 =========
async function initializeI18n() {
    try {
        await i18n.load('settings');
        console.log('[Settings] i18n 已加載');
        
        // 應用翻譯到 DOM 元素
        applyI18nTranslations();
    } catch (error) {
        console.error('[Settings] i18n 加載失敗:', error);
    }
}

function applyI18nTranslations() {
    // 找到所有帶有 data-i18n 屬性的元素
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = i18n.t(key);
        if (translation) {
            element.textContent = translation;
        }
    });
    
    // 處理 placeholder 翻譯
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        const translation = i18n.t(key);
        if (translation) {
            element.placeholder = translation;
        }
    });
}

// ========== DOMContentLoaded - 所有初始化在此執行 ==========
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化 i18n
    await initializeI18n();
    
    // 監聽語言變化
    if (i18n && typeof i18n.onLanguageChange === 'function') {
        i18n.onLanguageChange(() => {
            applyI18nTranslations();
        });
    }
    
    // ========= 麥克風權限控制 =========
    const requestMicBtn = document.getElementById('requestMicBtn');
    if (requestMicBtn) {
        requestMicBtn.addEventListener('click', async () => {
            const statusDiv = document.getElementById('status');
            if (!statusDiv) return;
            statusDiv.textContent = '';
            statusDiv.className = '';
            
            try {
                console.log("[Settings] 正在請求麥克風權限...");
                statusDiv.textContent = i18n.t('settings.mic.requesting');
                statusDiv.className = 'status pending';
                
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                
                console.log("[Settings] 麥克風權限已授予");
                statusDiv.textContent = i18n.t('settings.mic.granted');
                statusDiv.className = 'status success';
                
                stream.getTracks().forEach(track => track.stop());
                
            } catch (error) {
                console.error("[Settings] 麥克風權限被拒絕:", error);
                
                let errorMsg = error.name;
                if (error.name === 'NotAllowedError') {
                    errorMsg = i18n.t('settings.mic.denied.notallowed');
                } else if (error.name === 'NotFoundError') {
                    errorMsg = i18n.t('settings.mic.denied.notfound');
                } else if (error.name === 'NotReadableError') {
                    errorMsg = i18n.t('settings.mic.denied.notreadable');
                }
                
                statusDiv.textContent = i18n.t('settings.mic.error').replace('{error}', errorMsg);
                statusDiv.className = 'status error';
            }
        });
    }
    
    // ========= 通知設定 =========
    const notificationToggle = document.getElementById('notificationToggle');
    const notificationLabel = document.getElementById('notificationLabel');
    
    if (notificationToggle && notificationLabel) {
        try {
            // 通知設定不敏感，維持 storage.local（不需要 sync）
            const settings = await chrome.storage.local.get('notificationsEnabled');
            const isEnabled = settings.notificationsEnabled !== false;
            updateNotificationUI(isEnabled);
        } catch (error) {
            console.error('[Settings] 讀取通知設定失敗:', error);
        }
        
        notificationToggle.addEventListener('click', async () => {
            try {
                const isCurrentlyActive = notificationToggle.classList.contains('active');
                const newState = !isCurrentlyActive;
                await chrome.storage.local.set({ notificationsEnabled: newState });
                updateNotificationUI(newState);
                console.log('[Settings] 通知設定已更新:', newState);
            } catch (error) {
                console.error('[Settings] 保存通知設定失敗:', error);
            }
        });
    }
    
    // ========= Gemini API Key 設定區域 =========
    const geminiApiKeyInput = document.getElementById('geminiApiKey');
    const geminiSaveBtn = document.getElementById('saveGeminiKeyBtn');
    const geminiStatusDiv = document.getElementById('geminiKeyStatus');
    const apiKeyTip = document.getElementById('apiKeyTip');
    
    if (geminiApiKeyInput && geminiSaveBtn) {
        // 頁面加載時載入 API Key（優先級：1. storage.local 2. config.json）
        try {
            // 優先從 storage.local 讀取已儲存的 API Key
            const result = await chrome.storage.local.get('geminiApiKey');
            if (result.geminiApiKey) {
                geminiApiKeyInput.value = result.geminiApiKey;
                if (geminiStatusDiv) {
                    showGeminiStatus(i18n.t('settings.apikey.loaded'), 'success');
                }
            } else {
                // 如果 storage.local 沒有，則從 config.json 讀取
                console.log('[Settings] ' + i18n.t('settings.apikey.loading'));
                const configUrl = chrome.runtime.getURL('config.json');
                const configResponse = await fetch(configUrl);
                const configData = await configResponse.json();
                
                if (configData.geminiFlash && configData.geminiFlash.apiKey) {
                    const apiKeyFromConfig = configData.geminiFlash.apiKey;
                    geminiApiKeyInput.value = apiKeyFromConfig;
                    console.log('[Settings] 已從 config.json 載入 API Key');
                }
            }
        } catch (error) {
            console.error('[Settings] 讀取 API Key 失敗:', error);
        }
        
        // 添加輸入框 focus 事件顯示提醒
        if (apiKeyTip) {
            geminiApiKeyInput.addEventListener('focus', () => {
                apiKeyTip.style.display = 'block';
            });
            
            geminiApiKeyInput.addEventListener('blur', () => {
                apiKeyTip.style.display = 'none';
            });
        }
        
        // 儲存按鈕 - 存入 storage.local
        geminiSaveBtn.addEventListener('click', async () => {
            const apiKey = geminiApiKeyInput.value.trim();
            
            if (!apiKey) {
                showGeminiStatus(i18n.t('settings.apikey.error.empty'), 'error');
                return;
            }

            // 基本格式驗證（Google API Key 以 AIzaSy 開頭）
            if (!apiKey.startsWith('AIzaSy') || apiKey.length < 35) {
                showGeminiStatus(i18n.t('settings.apikey.error.invalid'), 'error');
                return;
            }
            
            try {
                // 存入 chrome.storage.local（明文，因為需要在 service-worker 中直接讀取）
                await chrome.storage.local.set({ geminiApiKey: apiKey });
                showGeminiStatus(i18n.t('settings.apikey.saved'), 'success');
                console.log('[Settings] Gemini API Key 已儲存');
            } catch (error) {
                console.error('[Settings] 儲存 API Key 失敗:', error);
                showGeminiStatus(i18n.t('settings.apikey.error.save'), 'error');
            }
        });
    }
    
    // ========= 麥克風語言設定 =========
    const micLangSelect = document.getElementById('micLanguage');
    if (micLangSelect) {
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
                
                const langStatus = document.getElementById('langStatus') || document.createElement('div');
                langStatus.id = 'langStatus';
                langStatus.textContent = i18n.t('settings.lang.saved');
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
    const activeModelSelect = document.getElementById('activeModel');
    if (activeModelSelect) {
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
                modelStatus.textContent = i18n.t('settings.model.saved');
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

// ========= 輔助函數 =========
function updateNotificationUI(isEnabled) {
    const notificationToggle = document.getElementById('notificationToggle');
    const notificationLabel = document.getElementById('notificationLabel');
    
    if (!notificationToggle || !notificationLabel) return;
    
    if (isEnabled) {
        notificationToggle.classList.add('active');
        notificationLabel.textContent = i18n.t('settings.notification.enabled');
    } else {
        notificationToggle.classList.remove('active');
        notificationLabel.textContent = i18n.t('settings.notification.disabled');
    }
}

function showGeminiStatus(message, type) {
    const geminiStatusDiv = document.getElementById('geminiKeyStatus');
    if (!geminiStatusDiv) return;
    
    geminiStatusDiv.textContent = message;
    geminiStatusDiv.className = `status ${type}`;
    geminiStatusDiv.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => { geminiStatusDiv.style.display = 'none'; }, 3000);
    }
}
