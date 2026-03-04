// API Configuration JavaScript

console.log('[API Config] 頁面已加載');

// Load saved API key on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('[API Config] DOMContentLoaded 事件觸發');
    loadSavedApiConfig();
    
    // 綁定按鈕事件監聽器
    const getApiKeyBtn = document.getElementById('getApiKeyBtn');
    const saveConfigBtn = document.getElementById('saveConfigBtn');
    const testConnectionBtn = document.getElementById('testConnectionBtn');
    const openConsoleBtn = document.getElementById('openConsoleBtn');
    
    console.log('[API Config] 按鈕元素檢查:');
    console.log('  - getApiKeyBtn:', !!getApiKeyBtn);
    console.log('  - saveConfigBtn:', !!saveConfigBtn);
    console.log('  - testConnectionBtn:', !!testConnectionBtn);
    console.log('  - openConsoleBtn:', !!openConsoleBtn);
    
    if (getApiKeyBtn) {
        getApiKeyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('[API Config] 用戶點擊獲取 API Key 按鈕');
            openGoogleApiUrl();
        });
    }
    
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('[API Config] 用戶點擊保存配置按鈕');
            saveGoogleApiConfig();
        });
    }
    
    if (testConnectionBtn) {
        testConnectionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('[API Config] 用戶點擊連接測試按鈕');
            testGoogleApiConnection();
        });
    }
    
    if (openConsoleBtn) {
        openConsoleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('[API Config] 用戶點擊打開 Google Console 按鈕');
            openGoogleConsole();
        });
    }
});

// Load saved API configuration from Chrome storage
function loadSavedApiConfig() {
    chrome.storage.local.get(['googleApiKey'], (result) => {
        if (result.googleApiKey) {
            document.getElementById('googleApiKey').value = result.googleApiKey;
            updateGoogleStatus(true);
            console.log('[API Config] ✅ 已加載保存的 Google API Key');
        } else {
            updateGoogleStatus(false);
            console.log('[API Config] ⚠️ 未找到保存的 Google API Key');
        }
    });
}

// Update Google API status display
function updateGoogleStatus(isConfigured) {
    const statusEl = document.getElementById('googleStatus');
    const statusTextEl = document.getElementById('statusText');
    
    if (isConfigured) {
        statusEl.classList.remove('disconnected');
        statusEl.classList.add('connected');
        statusTextEl.textContent = '✅ 已配置';
        console.log('[API Config] Google API 状态: 已配置');
    } else {
        statusEl.classList.remove('connected');
        statusEl.classList.add('disconnected');
        statusTextEl.textContent = '❌ 未配置';
        console.log('[API Config] Google API 状态: 未配置');
    }
}

// Save Google API Key
function saveGoogleApiConfig() {
    const apiKey = document.getElementById('googleApiKey').value.trim();
    
    if (!apiKey) {
        showStatus('請輸入 Google API Key', 'error');
        return;
    }
    
    // Basic validation: Google API keys are typically 39 characters
    if (apiKey.length < 20) {
        showStatus('⚠️ API Key 看起來太短，請確認輸入正確', 'warning');
    }
    
    // Save to Chrome storage
    chrome.storage.local.set({ googleApiKey: apiKey }, () => {
        if (chrome.runtime.lastError) {
            showStatus(`儲存失敗: ${chrome.runtime.lastError.message}`, 'error');
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
    const apiKey = document.getElementById('googleApiKey').value.trim();
    
    if (!apiKey) {
        showStatus('請先輸入並保存 Google API Key', 'error');
        return;
    }
    
    showStatus('🔄 正在測試連接...', 'warning');
    
    try {
        // Try a simple API call to test the key
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
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
            }
        );
        
        if (response.ok) {
            showStatus('✅ 連接成功！Google API Key 可正常使用', 'success');
            updateGoogleStatus(true);
            console.log('[API Config] ✅ API 連接測試成功');
        } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || response.statusText;
            showStatus(`❌ 連接失敗: ${errorMsg}`, 'error');
            console.error('[API Config] API 連接失敗:', errorMsg);
        }
    } catch (error) {
        showStatus(`❌ 測試失敗: ${error.message}`, 'error');
        console.error('[API Config] 測試錯誤:', error);
    }
}

// Show status message
function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    
    // Auto-hide after 5 seconds for success/warning
    if (type === 'success' || type === 'warning') {
        setTimeout(() => {
            statusEl.className = 'status-message';
        }, 5000);
    }
}

// Open Google API console
function openGoogleConsole() {
    chrome.tabs.create({ 
        url: 'https://console.cloud.google.com/apis/dashboard' 
    });
}

// Open Google API Key page
function openGoogleApiUrl() {
    chrome.tabs.create({ 
        url: 'https://aistudio.google.com/app/apikey' 
    });
}

console.log('[API Config] 初始化完成');
