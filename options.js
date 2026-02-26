// ========= 頁面區域 - 麥克風權限控制 =========
document.getElementById('requestMicBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = '';
    statusDiv.className = '';
    try {
        statusDiv.textContent = '正在請求麥克風權限...';
        statusDiv.className = 'status pending';
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        statusDiv.textContent = '✅ 麥克風權限已成功授予！您現在可以在 Side Panel 中使用語音輸入功能。';
        statusDiv.className = 'status success';
        stream.getTracks().forEach(track => track.stop());
    } catch (error) {
        let errorMsg = error.name;
        if (error.name === 'NotAllowedError') errorMsg = '您拒絕了麥克風許可權限';
        else if (error.name === 'NotFoundError') errorMsg = '未找到麥克風設備';
        else if (error.name === 'NotReadableError') errorMsg = '麥克風被其他程式佔用';
        statusDiv.textContent = `❌ 麥克風權限授予失敗: ${errorMsg}`;
        statusDiv.className = 'status error';
    }
});

// ========= 通知設定 =========
const notificationToggle = document.getElementById('notificationToggle');
const notificationLabel = document.getElementById('notificationLabel');

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const settings = await chrome.storage.local.get('notificationsEnabled');
        updateNotificationUI(settings.notificationsEnabled !== false);
    } catch (error) { console.error('[Options] 讀取通知設定失敗:', error); }
});

notificationToggle.addEventListener('click', async () => {
    try {
        const newState = !notificationToggle.classList.contains('active');
        await chrome.storage.local.set({ notificationsEnabled: newState });
        updateNotificationUI(newState);
    } catch (error) { console.error('[Options] 保存通知設定失敗:', error); }
});

function updateNotificationUI(isEnabled) {
    if (isEnabled) { notificationToggle.classList.add('active'); notificationLabel.textContent = '通知已啟用'; }
    else { notificationToggle.classList.remove('active'); notificationLabel.textContent = '通知已停用'; }
}

// ========= API Key 設定區域（AES-256-GCM 加密版） =========
const apiKeyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveApiKeyBtn');
const statusDiv = document.getElementById('apiKeyStatus');
const toggleVisibilityBtn = document.getElementById('toggleApiKeyVisibility');

document.addEventListener('DOMContentLoaded', updateConfigStatus);

toggleVisibilityBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleVisibilityBtn.textContent = '🙈 隱藏';
    } else {
        apiKeyInput.type = 'password';
        toggleVisibilityBtn.textContent = '👁 顯示';
    }
});

saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) { statusDiv.textContent = '❌ 請輸入有效的 API Key'; statusDiv.className = 'status error'; return; }
    if (!apiKey.startsWith('AIzaSy') || apiKey.length < 35) {
        statusDiv.textContent = '❌ API Key 格式不正確，請確認是否為有效的 Gemini API Key';
        statusDiv.className = 'status error'; return;
    }
    try {
        const encrypted = await encryptApiKey(apiKey);
        await chrome.storage.local.set({ geminiApiKeyEncrypted: encrypted });
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

document.getElementById('deleteApiKeyBtn').addEventListener('click', async () => {
    if (!confirm('確定要刪除已儲存的 API Key 嗎？')) return;
    try {
        await chrome.storage.local.remove(['geminiApiKeyEncrypted', 'javis_enc_key']);
        await chrome.storage.sync.remove('geminiApiKey');
        updateConfigStatus();
        statusDiv.textContent = '✅ API Key 已刪除';
        statusDiv.className = 'status success';
    } catch (error) { console.error('[Options] 刪除 API Key 失敗:', error); }
});

async function updateConfigStatus() {
    try {
        const result = await chrome.storage.local.get('geminiApiKeyEncrypted');
        const configStatus = document.getElementById('configStatus');
        if (!result.geminiApiKeyEncrypted) {
            const oldResult = await chrome.storage.sync.get('geminiApiKey');
            if (oldResult.geminiApiKey) {
                configStatus.innerHTML = '⚠️ 偵測到舊版未加密的 API Key<br><small style="color:#856404;">請重新輸入您的 API Key 以升級為加密儲存</small>';
                configStatus.className = 'status warning';
            } else {
                configStatus.innerHTML = '❌ 尚未設定 API Key<br><small style="color:#666;">請在下方輸入您的 Gemini API Key</small>';
                configStatus.className = 'status error';
            }
        } else {
            try {
                const decrypted = await decryptApiKey(result.geminiApiKeyEncrypted);
                const masked = maskApiKey(decrypted);
                configStatus.innerHTML = `✅ 已設定 API Key（AES-256-GCM 加密儲存於本機）<br><small style="color:#666;font-family:monospace;">金鑰: ${masked}</small>`;
            } catch { configStatus.innerHTML = '✅ 已設定 API Key（加密儲存於本機）'; }
            configStatus.className = 'status success';
        }
    } catch (error) { console.error('[Options] 檢查配置時出錯:', error); }
}

// ========= 麥克風語言設定 =========
const micLangSelect = document.getElementById('micLangSelect');

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const result = await chrome.storage.local.get('micLanguage');
        micLangSelect.value = result.micLanguage || 'zh-TW';
    } catch (error) { console.error('[Options] 讀取麥克風語言設定失敗:', error); }
});

micLangSelect.addEventListener('change', async () => {
    try {
        await chrome.storage.local.set({ micLanguage: micLangSelect.value });
        let langStatus = document.getElementById('langStatus');
        if (!langStatus) {
            langStatus = document.createElement('div');
            langStatus.id = 'langStatus';
            micLangSelect.parentElement.appendChild(langStatus);
        }
        langStatus.textContent = '✅ 語言設定已儲存';
        langStatus.className = 'status success';
        langStatus.style.display = 'block';
        setTimeout(() => { langStatus.style.display = 'none'; }, 3000);
    } catch (error) { console.error('[Options] 保存麥克風語言設定失敗:', error); }
});