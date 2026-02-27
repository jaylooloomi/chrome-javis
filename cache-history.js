// cache-history.js - 缓存历史页面脚本

console.log('[CacheHistory] 页面加载');

// DOM 元素
const cacheList = document.getElementById('cacheList');
const emptyState = document.getElementById('emptyState');
const loadingIndicator = document.getElementById('loadingIndicator');
const statusMessage = document.getElementById('statusMessage');
const refreshBtn = document.getElementById('refreshBtn');
const clearBtn = document.getElementById('clearBtn');
const totalCacheCount = document.getElementById('totalCacheCount');
const recentCount = document.getElementById('recentCount');
const maxCache = document.getElementById('maxCache');

// 事件监听
refreshBtn.addEventListener('click', loadCacheHistory);
clearBtn.addEventListener('click', clearCache);

// 页面加载时获取缓存
document.addEventListener('DOMContentLoaded', () => {
    console.log('[CacheHistory] DOM 加载完成，获取缓存历史');
    loadCacheHistory();
});

/**
 * 从 Service Worker 获取缓存统计数据
 */
async function loadCacheHistory() {
    try {
        showLoading(true);
        clearStatus();
        
        console.log('[CacheHistory] 请求缓存统计数据');
        
        // 发送消息给 Service Worker
        const response = await chrome.runtime.sendMessage({
            action: 'get_cache_stats'
        });
        
        console.log('[CacheHistory] 收到响应:', response);
        
        if (response && response.status === 'success') {
            const stats = response.data;
            
            // 更新统计卡片
            updateStats(stats);
            
            // 更新缓存列表
            if (stats.recentEntries && stats.recentEntries.length > 0) {
                renderCacheList(stats.recentEntries);
                emptyState.style.display = 'none';
            } else {
                cacheList.innerHTML = '';
                emptyState.style.display = 'block';
            }
            
            showStatus('✅ 缓存数据已更新', 'success');
        } else {
            showStatus('❌ 获取缓存失败: ' + (response?.error || '未知错误'), 'error');
        }
    } catch (error) {
        console.error('[CacheHistory] 错误:', error);
        showStatus('❌ 错误: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * 更新统计卡片
 */
function updateStats(stats) {
    totalCacheCount.textContent = stats.totalCacheSize || 0;
    recentCount.textContent = stats.recentCount || 0;
    maxCache.textContent = stats.maxCacheSize || 50;  // 改為顯示 maxCacheSize（50）
    
    // 🆕 Phase 4：顯示過期快取統計
    const expiredCountEl = document.getElementById('expiredCount');
    const validCountEl = document.getElementById('validCount');
    
    if (expiredCountEl && stats.expiredCount !== undefined) {
        expiredCountEl.textContent = stats.expiredCount;
    }
    
    if (validCountEl && stats.validCount !== undefined) {
        validCountEl.textContent = stats.validCount;
    }
    
    // 更新存儲使用信息
    if (stats.storage) {
        const storage = stats.storage;
        const progressBar = document.getElementById('storageProgressBar');
        const progressText = document.getElementById('storageText');
        const usedSizeEl = document.getElementById('usedSize');
        const percentageEl = document.getElementById('percentage');
        
        if (progressBar) {
            progressBar.style.width = storage.percentage + '%';
            // 根據狀態改變顏色
            progressBar.className = 'progress-bar';
            if (storage.status === 'warning') {
                progressBar.classList.add('warning');
            } else if (storage.status === 'critical') {
                progressBar.classList.add('critical');
            }
        }
        
        if (progressText) {
            progressText.textContent = storage.percentage + '%';
        }
        
        if (usedSizeEl) {
            // 改為顯示 "N / 50" 的格式（項目數）
            usedSizeEl.textContent = storage.used + ' / ' + storage.max;
        }
        
        if (percentageEl) {
            percentageEl.textContent = storage.percentage + '%';
            percentageEl.className = 'percentage-badge';
            if (storage.status === 'warning') {
                percentageEl.classList.add('warning');
            } else if (storage.status === 'critical') {
                percentageEl.classList.add('critical');
            }
        }
    }
}

/**
 * 渲染缓存列表
 */
function renderCacheList(entries) {
    cacheList.innerHTML = '';
    
    entries.forEach((entry, index) => {
        const li = document.createElement('li');
        li.className = 'cache-item';
        
        // 格式化时间戳
        const timeStr = formatTime(entry.timestamp);
        
        // 🆕 Phase 4：計算過期倒計時（還剩多少天）
        let expiryInfo = '';
        if (entry.expiresAt) {
            const now = Date.now();
            const daysRemaining = Math.ceil((entry.expiresAt - now) / (24 * 60 * 60 * 1000));
            
            if (daysRemaining <= 0) {
                expiryInfo = `<span class="expiry-expired">已過期</span>`;
            } else if (daysRemaining <= 7) {
                expiryInfo = `<span class="expiry-warning">⚠️ 還剩 ${daysRemaining} 天過期</span>`;
            } else if (daysRemaining <= 14) {
                expiryInfo = `<span class="expiry-info">ℹ️ 還剩 ${daysRemaining} 天過期</span>`;
            } else {
                expiryInfo = `<span class="expiry-valid">✓ 有效期：${daysRemaining} 天</span>`;
            }
        }
        
        // 格式化 args 为可读文本
        const argsStr = JSON.stringify(entry.args, null, 2).substring(0, 200);
        
        li.innerHTML = `
            <div class="cache-item-header">
                <div class="cache-item-input-container">
                    <div class="cache-item-input">
                        #${index + 1} "${entry.userInput}"
                    </div>
                </div>
                <button class="cache-item-delete-btn" title="删除此缓存">🗑️</button>
            </div>
            <div class="cache-item-details">
                <div class="detail-row">
                    <span class="detail-label">技能</span>
                    <span class="detail-value">${escapeHtml(entry.skill)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">参数</span>
                    <span class="detail-value"><code>${escapeHtml(argsStr)}</code></span>
                </div>
            </div>
            <div class="cache-item-time">
                ⏱️ ${timeStr}
            </div>
            <div class="cache-item-expiry">
                ${expiryInfo}
            </div>
        `;
        
        cacheList.appendChild(li);
        
        // 为删除按钮添加事件监听
        const deleteBtn = li.querySelector('.cache-item-delete-btn');
        deleteBtn.addEventListener('click', () => {
            deleteSpecificCache(entry.userInput, li);
        });
    });
}

/**
 * 格式化时间戳
 */
function formatTime(timestamp) {
    if (!timestamp) return '未知时间';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} 天前`;
    if (hours > 0) return `${hours} 小时前`;
    if (minutes > 0) return `${minutes} 分钟前`;
    if (seconds > 0) return `${seconds} 秒前`;
    return '刚刚';
}

/**
 * 删除指定的单条缓存
 */
async function deleteSpecificCache(userInput, element) {
    if (!confirm(`确定要删除此缓存吗？\n输入："${userInput}"`)) {
        return;
    }
    
    try {
        console.log('[CacheHistory] 请求删除指定缓存:', userInput);
        
        const response = await chrome.runtime.sendMessage({
            action: 'delete_cache_item',
            userInput: userInput
        });
        
        if (response && response.status === 'success') {
            // 删除 UI 中的该项
            element.style.opacity = '0';
            element.style.transform = 'translateX(-20px)';
            
            setTimeout(() => {
                element.remove();
                
                // 如果列表为空，显示空状态
                if (cacheList.children.length === 0) {
                    emptyState.style.display = 'block';
                }
                
                showStatus(`✅ 已删除缓存：${userInput}`, 'success');
                loadCacheStats();  // 刷新统计信息
            }, 300);
        } else {
            showStatus('❌ 删除失败', 'error');
        }
    } catch (error) {
        console.error('[CacheHistory] 删除错误:', error);
        showStatus('❌ 错误: ' + error.message, 'error');
    }
}

/**
 * 清空缓存
 */
async function clearCache() {
    if (!confirm('确定要清空所有缓存吗？这个操作不可撤销。')) {
        return;
    }
    
    try {
        showLoading(true);
        clearStatus();
        
        console.log('[CacheHistory] 请求清空缓存');
        
        const response = await chrome.runtime.sendMessage({
            action: 'clear_cache'
        });
        
        if (response && response.status === 'success') {
            cacheList.innerHTML = '';
            emptyState.style.display = 'block';
            updateStats({ totalCacheSize: 0, recentCount: 0, maxRecent: 10 });
            showStatus('✅ 缓存已清空', 'success');
        } else {
            showStatus('❌ 清空缓存失败', 'error');
        }
    } catch (error) {
        console.error('[CacheHistory] 清空错误:', error);
        showStatus('❌ 错误: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * 显示或隐藏加载指示器
 */
function showLoading(show) {
    loadingIndicator.style.display = show ? 'block' : 'none';
}

/**
 * 显示状态消息
 */
function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
    
    // 3 秒后自动隐藏成功消息
    if (type === 'success') {
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 3000);
    }
}

/**
 * 清除状态消息
 */
function clearStatus() {
    statusMessage.style.display = 'none';
    statusMessage.className = 'status-message';
}

/**
 * HTML 转义函数
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
