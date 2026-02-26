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
    maxCache.textContent = stats.maxRecent || 10;
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
        
        // 格式化 args 为可读文本
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
                    <span class="detail-label">参数</span>
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
    statusMessage.className = `status ${type}`;
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
    statusMessage.className = 'status';
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
