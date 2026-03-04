// API Configuration JavaScript

console.log('[API Config] 頁面已加載');

// Load saved API key on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('[API Config] DOMContentLoaded 事件觸發');
    loadSavedApiConfig();
    
    // 添加頁面加載完成日誌
    console.log('[API Config] HTML 元素檢查:');
    console.log('  - googleApiKey 輸入框:', !!document.getElementById('googleApiKey'));
    console.log('  - googleStatus 狀態:', !!document.getElementById('googleStatus'));
    console.log('  - statusMessage 消息框:', !!document.getElementById('statusMessage'));
});

// Load saved API configuration from Chrome storage
function loadSavedApiConfig() {
    chrome.storage.local.get(['googleApiKey'], (result) => {
        if (chrome.runtime.lastError) {
            console.error('[API Config] Chrome storage 錯誤:', chrome.runtime.lastError);
            showStatus('無法訪問本機存儲', 'error');
            return;
        }
        
        if (result.googleApiKey) {
            const apiKeyInput = document.getElementById('googleApiKey');
            if (apiKeyInput) {
                apiKeyInput.value = result.googleApiKey;
                updateGoogleStatus(true);
                console.log('[API Config] ✅ 已加載保存的 Google API Key');
            }
        } else {
            updateGoogleStatus(false);
            console.log('[API Config] ⚠️ 未找到保存的 Google API Key');
        }
    });
}

// Update Google API status display
function updateGoogleStatus(isConfigured) {
    console.log('[API Config] updateGoogleStatus 被調用，已配置:', isConfigured);
    
    const statusEl = document.getElementById('googleStatus');
    const statusTextEl = document.getElementById('statusText');
    
    if (!statusEl || !statusTextEl) {
        console.error('[API Config] 找不到狀態顯示元素', {
            statusEl: !!statusEl,
            statusTextEl: !!statusTextEl
        });
        return;
    }
    
    if (isConfigured) {
        statusEl.classList.remove('disconnected');
        statusEl.classList.add('connected');
        statusTextEl.textContent = '✅ 已配置';
        console.log('[API Config] Google API 使用狀態: 已配置');
    } else {
        statusEl.classList.remove('connected');
        statusEl.classList.add('disconnected');
        statusTextEl.textContent = '❌ 未配置';
        console.log('[API Config] Google API 使用狀態: 未配置');
    }
}

// Save Google API Key
function saveGoogleApiConfig() {
    console.log('[API Config] saveGoogleApiConfig 被調用');
    
    const apiKeyInput = document.getElementById('googleApiKey');
    if (!apiKeyInput) {
        console.error('[API Config] 找不到 googleApiKey 輸入框');
        return;
    }
    
    const apiKey = apiKeyInput.value.trim();
    console.log('[API Config] API Key 長度:', apiKey.length);
    
    if (!apiKey) {
        showStatus('請輸入 Google API Key', 'error');
        console.warn('[API Config] API Key 為空');
        return;
    }
    
    // Basic validation: Google API keys are typically 39 characters
    if (apiKey.length < 20) {
        showStatus('⚠️ API Key 看起來太短，請確認輸入正確', 'warning');
        console.warn('[API Config] API Key 長度異常:', apiKey.length);
    }
    
    console.log('[API Config] 開始保存 API Key...');
    
    // Save to Chrome storage
    chrome.storage.local.set({ googleApiKey: apiKey }, () => {
        if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message || '未知錯誤';
            showStatus(`儲存失敗: ${errorMsg}`, 'error');
            console.error('[API Config] 儲存失敗:', chrome.runtime.lastError);
        } else {
            updateGoogleStatus(true);
            showStatus('✅ Google API Key 已成功保存', 'success');
            console.log('[API Config] ✅ API Key 已正確保存');
        }
    });
}

// Test Google API connection
async function testGoogleApiConnection() {
    console.log('[API Config] testGoogleApiConnection 被調用');
    
    const apiKeyInput = document.getElementById('googleApiKey');
    if (!apiKeyInput) {
        console.error('[API Config] 找不到 googleApiKey 輸入框');
        showStatus('頁面加載錯誤，請刷新重試', 'error');
        return;
    }
    
    const apiKey = apiKeyInput.value.trim();
    console.log('[API Config] 測試 API Key，長度:', apiKey.length);
    
    if (!apiKey) {
        showStatus('請先輸入並保存 Google API Key', 'error');
        console.warn('[API Config] API Key 為空，無法測試');
        return;
    }
    
    showStatus('🔄 正在測試連接...', 'warning');
    console.log('[API Config] 開始連接測試...');
    
    try {
        // Try a simple API call to test the key
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
        
        console.log('[API Config] 發送測試請求到 Google API');
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: '說 OK'
                    }]
                }]
            })
        });
        
        console.log('[API Config] 收到響應，狀態碼:', response.status);
        
        if (response.ok) {
            showStatus('✅ 連接成功！Google API Key 可正常使用', 'success');
            updateGoogleStatus(true);
            console.log('[API Config] ✅ API 連接測試成功');
        } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || response.statusText || '未知錯誤';
            showStatus(`❌ 連接失敗 (${response.status}): ${errorMsg}`, 'error');
            console.error('[API Config] API 連接失敗:', response.status, errorMsg);
        }
    } catch (error) {
        showStatus(`❌ 測試失敗: ${error.message}`, 'error');
        console.error('[API Config] 測試錯誤:', error);
    }
}

// Show status message
function showStatus(message, type = 'info') {
    console.log('[API Config] showStatus 被調用，訊息:', message, '類型:', type);
    
    const statusEl = document.getElementById('statusMessage');
    if (!statusEl) {
        console.error('[API Config] 找不到 statusMessage 元素');
        alert(message); // Fallback to alert if element not found
        return;
    }
    
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    statusEl.style.display = 'block';
    
    console.log('[API Config] 狀態消息已更新，類別:', statusEl.className);
    
    // Auto-hide after 5 seconds for success/warning
    if (type === 'success' || type === 'warning') {
        const timeoutId = setTimeout(() => {
            statusEl.className = 'status-message';
            statusEl.style.display = 'none';
            console.log('[API Config] 狀態消息已自動隱藏');
        }, 5000);
        
        console.log('[API Config] 設置 5 秒後自動隱藏，timeoutId:', timeoutId);
    }
}

// Open Google API console
function openGoogleConsole() {
    console.log('[API Config] openGoogleConsole 被調用');
    try {
        chrome.tabs.create({ 
            url: 'https://console.cloud.google.com/apis/dashboard' 
        });
    } catch (error) {
        console.error('[API Config] 打開 Google Console 失敗:', error);
        showStatus(`無法打開 Google Console: ${error.message}`, 'error');
    }
}

// Open Google API Key page
function openGoogleApiUrl() {
    console.log('[API Config] openGoogleApiUrl 被調用');
    try {
        chrome.tabs.create({ 
            url: 'https://aistudio.google.com/app/apikey' 
        });
    } catch (error) {
        console.error('[API Config] 打開 API Key 頁面失敗:', error);
        showStatus(`無法打開 API Key 頁面: ${error.message}`, 'error');
    }
}

console.log('[API Config] 腳本加載完成，所有函數已定義');
