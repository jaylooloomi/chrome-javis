// ======== 選項頁面 - 麥克風權限授予 ========
document.getElementById('requestMicBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = '';
    statusDiv.className = '';
    
    try {
        console.log("[Options] 正在請求麥克風權限...");
        statusDiv.textContent = '正在請求麥克風權限...';
        statusDiv.className = 'status pending';
        
        // 請求麥克風訪問
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        console.log("[Options] 麥克風權限已授予");
        statusDiv.textContent = '✅ 麥克風權限已成功授予！您現在可以在 Side Panel 中使用語音輸入功能。';
        statusDiv.className = 'status success';
        
        // 停止音頻流
        stream.getTracks().forEach(track => track.stop());
        
    } catch (error) {
        console.error("[Options] 麥克風權限被拒絕:", error);
        
        let errorMsg = error.name;
        if (error.name === 'NotAllowedError') {
            errorMsg = '您拒絕了麥克風訪問權限';
        } else if (error.name === 'NotFoundError') {
            errorMsg = '未找到麥克風設備';
        } else if (error.name === 'NotReadableError') {
            errorMsg = '麥克風被其他應用程式佔用';
        }
        
        statusDiv.textContent = `❌ 麥克風權限授予失敗: ${errorMsg}`;
        statusDiv.className = 'status error';
    }
});

// ======== 通知設定 ========
const notificationToggle = document.getElementById('notificationToggle');
const notificationLabel = document.getElementById('notificationLabel');

// 頁面加載時讀取通知設定
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const settings = await chrome.storage.sync.get('notificationsEnabled');
        const isEnabled = settings.notificationsEnabled !== false;  // 默認啟用
        
        updateNotificationUI(isEnabled);
    } catch (error) {
        console.error('[Options] 讀取通知設定失敗:', error);
    }
});

// 通知開關點擊事件
notificationToggle.addEventListener('click', async () => {
    try {
        const isCurrentlyActive = notificationToggle.classList.contains('active');
        const newState = !isCurrentlyActive;
        
        // 保存到 chrome.storage.sync
        await chrome.storage.sync.set({ notificationsEnabled: newState });
        
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
        notificationLabel.textContent = '通知已關閉';
    }
}

// ======== 麥克風語言設定 ========
const micLanguageSelect = document.getElementById('micLanguage');

// 頁面加載時讀取麥克風語言設定
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const settings = await chrome.storage.sync.get('notificationsEnabled');
        const isEnabled = settings.notificationsEnabled !== false;  // 默認啟用
        
        updateNotificationUI(isEnabled);
        
        // 讀取麥克風語言設定
        const langSettings = await chrome.storage.sync.get('micLanguage');
        const selectedLanguage = langSettings.micLanguage || 'zh-TW';  // 默認繁體中文
        micLanguageSelect.value = selectedLanguage;
        console.log('[Options] 麥克風語言已加載:', selectedLanguage);
    } catch (error) {
        console.error('[Options] 讀取設定失敗:', error);
    }
});

// 語言下拉菜單變更事件
micLanguageSelect.addEventListener('change', async (e) => {
    const selectedLanguage = e.target.value;
    try {
        await chrome.storage.sync.set({ micLanguage: selectedLanguage });
        console.log('[Options] 麥克風語言已更新:', selectedLanguage);
    } catch (error) {
        console.error('[Options] 保存麥克風語言失敗:', error);
    }
});
