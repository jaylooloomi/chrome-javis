// settings.js - 設定頁面的交互邏輯

console.log('[Settings] 設定頁面已加載');

// ========== 頁籤切換邏輯 ==========

// 綁定頁籤按鈕點擊事件
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
        const tabName = e.target.getAttribute('data-tab');
        switchTab(tabName);
    });
});

/**
 * 切換頁籤
 */
function switchTab(tabName) {
    console.log(`[Settings] 切換到頁籤: ${tabName}`);
    
    // 隱藏所有內容
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // 移除所有按鈕的 active 類
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 顯示選中的頁籤內容
    const contentElement = document.getElementById(tabName);
    if (contentElement) {
        contentElement.classList.add('active');
    }
    
    // 設定選中的按鈕
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    // 如果切換到緩存頁籤，自動加載數據
    if (tabName === 'cache') {
        loadCacheHistory();
    }
}

// ========== 設定選項邏輯 ==========

/**
 * 保存設定
 */
async function saveSettings() {
    try {
        const settings = {
            aiModel: document.getElementById('aiModel')?.value || 'gemini',
            apiKey: document.getElementById('apiKey')?.value || '',
            apiBase: document.getElementById('apiBase')?.value || '',
            theme: document.getElementById('theme')?.value || 'light',
            language: document.getElementById('language')?.value || 'zh-TW',
            cacheSize: document.getElementById('cacheSize')?.value || '100',
            timeout: document.getElementById('timeout')?.value || '30'
        };
        
        console.log('[Settings] 正在保存設定:', settings);
        
        // 保存到 Chrome storage
        await chrome.storage.sync.set(settings);
        
        console.log('[Settings] 設定已保存');
        showStatus('settingsStatus', '✅ 設定已保存', 'success');
        
        // 3 秒後隱藏消息
        setTimeout(() => {
            const statusEl = document.getElementById('settingsStatus');
            if (statusEl) {
                statusEl.style.display = 'none';
            }
        }, 3000);
        
    } catch (error) {
        console.error('[Settings] 保存設定失敗:', error);
        showStatus('settingsStatus', '❌ 保存失敗: ' + error.message, 'error');
    }
}

/**
 * 加載保存的設定
 */
async function loadSettings() {
    try {
        console.log('[Settings] 加載保存的設定');
        
        const settings = await chrome.storage.sync.get([
            'aiModel',
            'apiKey',
            'apiBase',
            'theme',
            'language',
            'cacheSize',
            'timeout'
        ]);
        
        // 填充表單
        if (document.getElementById('aiModel')) {
            document.getElementById('aiModel').value = settings.aiModel || 'gemini';
        }
        if (document.getElementById('apiKey')) {
            document.getElementById('apiKey').value = settings.apiKey || '';
        }
        if (document.getElementById('apiBase')) {
            document.getElementById('apiBase').value = settings.apiBase || '';
        }
        if (document.getElementById('theme')) {
            document.getElementById('theme').value = settings.theme || 'light';
        }
        if (document.getElementById('language')) {
            document.getElementById('language').value = settings.language || 'zh-TW';
        }
        if (document.getElementById('cacheSize')) {
            document.getElementById('cacheSize').value = settings.cacheSize || '100';
        }
        if (document.getElementById('timeout')) {
            document.getElementById('timeout').value = settings.timeout || '30';
        }
        
        console.log('[Settings] 設定已加載:', settings);
    } catch (error) {
        console.error('[Settings] 加載設定失敗:', error);
    }
}

/**
 * 重置為預設值
 */
async function resetSettings() {
    if (!confirm('確定要重置所有設定為預設值嗎？')) {
        return;
    }
    
    try {
        console.log('[Settings] 重置設定為預設值');
        
        const defaultSettings = {
            aiModel: 'gemini',
            apiKey: '',
            apiBase: 'http://localhost:11434',
            theme: 'light',
            language: 'zh-TW',
            cacheSize: '100',
            timeout: '30'
        };
        
        await chrome.storage.sync.set(defaultSettings);
        
        // 重新加載設定
        await loadSettings();
        
        console.log('[Settings] 已重置為預設值');
        showStatus('settingsStatus', '✅ 已重置為預設值', 'success');
        
        setTimeout(() => {
            const statusEl = document.getElementById('settingsStatus');
            if (statusEl) {
                statusEl.style.display = 'none';
            }
        }, 3000);
        
    } catch (error) {
        console.error('[Settings] 重置失敗:', error);
        showStatus('settingsStatus', '❌ 重置失敗: ' + error.message, 'error');
    }
}

/**
 * 匯出設定為 JSON
 */
async function exportSettings() {
    try {
        console.log('[Settings] 匯出設定');
        
        const settings = await chrome.storage.sync.get(null);
        
        const dataStr = JSON.stringify(settings, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `omnassistant-settings-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        console.log('[Settings] 設定已匯出');
        showStatus('settingsStatus', '✅ 設定已匯出', 'success');
        
    } catch (error) {
        console.error('[Settings] 匯出失敗:', error);
        showStatus('settingsStatus', '❌ 匯出失敗: ' + error.message, 'error');
    }
}

/**
 * 匯入設定
 */
function importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.addEventListener('change', async (e) => {
        try {
            const file = e.target.files[0];
            if (!file) return;
            
            console.log('[Settings] 正在匯入設定:', file.name);
            
            const text = await file.text();
            const settings = JSON.parse(text);
            
            // 驗證設定格式
            if (typeof settings !== 'object') {
                throw new Error('無效的設定格式');
            }
            
            // 保存導入的設定
            await chrome.storage.sync.set(settings);
            
            // 重新加載設定
            await loadSettings();
            
            console.log('[Settings] 設定已匯入');
            showStatus('settingsStatus', '✅ 設定已匯入', 'success');
            
            setTimeout(() => {
                const statusEl = document.getElementById('settingsStatus');
                if (statusEl) {
                    statusEl.style.display = 'none';
                }
            }, 3000);
            
        } catch (error) {
            console.error('[Settings] 匯入失敗:', error);
            showStatus('settingsStatus', '❌ 匯入失敗: ' + error.message, 'error');
        }
    });
    
    input.click();
}

// ========== 緩存歷史邏輯 ==========

/**
 * 從 Service Worker 獲取緩存統計數據
 */
async function loadCacheHistory() {
    try {
        showCacheLoading(true);
        clearCacheStatus();
        
        console.log('[Settings] 請求緩存統計數據');
        
        const response = await chrome.runtime.sendMessage({
            action: 'get_cache_stats'
        });
        
        console.log('[Settings] 收到響應:', response);
        
        if (response && response.status === 'success') {
            const stats = response.data;
            
            // 更新統計卡片
            updateCacheStats(stats);
            
            // 更新緩存列表
            if (stats.recentEntries && stats.recentEntries.length > 0) {
                renderCacheList(stats.recentEntries);
                document.getElementById('emptyState').style.display = 'none';
            } else {
                document.getElementById('cacheList').innerHTML = '';
                document.getElementById('emptyState').style.display = 'block';
            }
            
            showCacheStatus('✅ 緩存數據已更新', 'success');
        } else {
            showCacheStatus('❌ 獲取緩存失敗: ' + (response?.error || '未知錯誤'), 'error');
        }
    } catch (error) {
        console.error('[Settings] 錯誤:', error);
        showCacheStatus('❌ 錯誤: ' + error.message, 'error');
    } finally {
        showCacheLoading(false);
    }
}

/**
 * 更新緩存統計卡片
 */
function updateCacheStats(stats) {
    document.getElementById('totalCacheCount').textContent = stats.totalCacheSize || 0;
    document.getElementById('recentCount').textContent = stats.recentCount || 0;
    document.getElementById('maxCache').textContent = stats.maxRecent || 10;
}

/**
 * 渲染緩存列表
 */
function renderCacheList(entries) {
    const cacheList = document.getElementById('cacheList');
    cacheList.innerHTML = '';
    
    entries.forEach((entry, index) => {
        const li = document.createElement('li');
        li.className = 'cache-item';
        
        const timeStr = formatTime(entry.timestamp);
        const argsStr = JSON.stringify(entry.args, null, 2).substring(0, 200);
        
        li.innerHTML = `
            <div class="cache-item-input">
                #${index + 1} "${entry.userInput}"
            </div>
            <div class="cache-item-details">
                <div class="detail-row">
                    <span class="detail-label">技能</span>
                    <span class="detail-value">${escapeHtml(entry.skill)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">參數</span>
                    <span class="detail-value"><code>${escapeHtml(argsStr)}</code></span>
                </div>
            </div>
            <div class="cache-item-time">
                ⏱️ ${timeStr}
            </div>
        `;
        
        cacheList.appendChild(li);
    });
}

/**
 * 格式化時間戳為相對時間
 */
function formatTime(timestamp) {
    if (!timestamp) return '未知時間';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} 天前`;
    if (hours > 0) return `${hours} 小時前`;
    if (minutes > 0) return `${minutes} 分鐘前`;
    if (seconds > 0) return `${seconds} 秒前`;
    return '剛剛';
}

/**
 * 清空緩存
 */
async function clearCache() {
    if (!confirm('確定要清空所有緩存嗎？這個操作不可撤銷。')) {
        return;
    }
    
    try {
        showCacheLoading(true);
        clearCacheStatus();
        
        console.log('[Settings] 請求清空緩存');
        
        const response = await chrome.runtime.sendMessage({
            action: 'clear_cache'
        });
        
        if (response && response.status === 'success') {
            document.getElementById('cacheList').innerHTML = '';
            document.getElementById('emptyState').style.display = 'block';
            updateCacheStats({ totalCacheSize: 0, recentCount: 0, maxRecent: 10 });
            showCacheStatus('✅ 緩存已清空', 'success');
        } else {
            showCacheStatus('❌ 清空緩存失敗', 'error');
        }
    } catch (error) {
        console.error('[Settings] 清空錯誤:', error);
        showCacheStatus('❌ 錯誤: ' + error.message, 'error');
    } finally {
        showCacheLoading(false);
    }
}

/**
 * 顯示或隱藏加載指示器
 */
function showCacheLoading(show) {
    document.getElementById('loadingIndicator').style.display = show ? 'block' : 'none';
}

/**
 * 顯示緩存狀態消息
 */
function showCacheStatus(message, type) {
    const statusEl = document.getElementById('cacheStatus');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }
}

/**
 * 清除狀態消息
 */
function clearCacheStatus() {
    const statusEl = document.getElementById('cacheStatus');
    statusEl.style.display = 'none';
    statusEl.className = 'status';
}

/**
 * HTML 轉義函數
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * 顯示設定狀態消息
 */
function showStatus(elementId, message, type) {
    const statusEl = document.getElementById(elementId);
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
}

// ========== 初始化 ==========

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Settings] 初始化設定頁面');
    
    // 加載保存的設定
    loadSettings();
    
    // 綁定控制按鈕
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadCacheHistory);
    }
    
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearCache);
    }
});
