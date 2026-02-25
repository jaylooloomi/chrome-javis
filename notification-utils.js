/**
 * 统一的通知工具函数
 * 支持成功、失败、信息三种类型
 */

// 通知图标配置
const NOTIFICATION_CONFIG = {
    successBgColor: '#4CAF50',        // 绿色
    errorBgColor: '#F44336',          // 红色
    infoBgColor: '#2196F3'            // 蓝色
};

/**
 * 显示通知
 * @param {string} type - 通知类型: 'success' | 'error' | 'info'
 * @param {string} skillName - 技能名称，用于生成完整标题
 * @param {string} message - 通知信息
 */
async function showNotification(type, skillName, message) {
    try {
        // 检查用户是否启用了通知
        const settings = await chrome.storage.sync.get('notificationsEnabled');
        console.log('[Notifications] 讀取設定:', settings);
        
        if (settings.notificationsEnabled === false) {
            console.log('[Notifications] ⚠️ 用户已关闭通知，跳過顯示');
            return;
        }
        
        console.log('[Notifications] ✅ 通知已啟用，繼續顯示');

        // 生成通知标题
        let titleEmoji = '';
        switch (type) {
            case 'success':
                titleEmoji = '✅';
                break;
            case 'error':
                titleEmoji = '❌';
                break;
            case 'info':
                titleEmoji = 'ℹ️';
                break;
            default:
                titleEmoji = '📢';
        }

        const notificationId = `notification-${Date.now()}`;
        const title = `${titleEmoji} ${skillName}`;

        // 创建通知（使用 chrome.runtime.getURL 获取图标的正确路径）
        const notificationOptions = {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('images/icon-128.ico'),
            title: title,
            message: message,
            priority: 2,
            requireInteraction: true
        };
        
        console.log('[Notifications] 正在創建通知，iconUrl:', notificationOptions.iconUrl);
        
        await chrome.notifications.create(notificationId, notificationOptions);

        console.log('[Notifications] ✅ 已显示通知:', { type, skillName, message, notificationId });

        // 10秒后自动关闭通知（改長便於測試）
        setTimeout(() => {
            chrome.notifications.clear(notificationId, () => {
                console.log('[Notifications] 通知已自动关闭');
            });
        }, 10000);  // 改为 10 秒

    } catch (error) {
        console.error('[Notifications] 显示通知失败:', error);
    }
}

/**
 * 显示成功通知
 */
function showSuccessNotification(skillName, message) {
    return showNotification('success', skillName, message);
}

/**
 * 显示失败通知
 */
function showErrorNotification(skillName, message) {
    return showNotification('error', skillName, message);
}

/**
 * 显示信息通知
 */
function showInfoNotification(skillName, message) {
    return showNotification('info', skillName, message);
}

// ======== 导出函数供 SidePanel 使用 ========
export { showSuccessNotification, showErrorNotification, showInfoNotification, showNotification };
// ======== Service Worker 消息監聽（用於從 Service Worker 調用通知） ========
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SHOW_NOTIFICATION') {
        console.log('[Notifications] 收到來自 Service Worker 的通知請求:', request);
        showNotification(request.type, request.skillName, request.message)
            .then(() => {
                sendResponse({ status: 'success' });
            })
            .catch((error) => {
                console.error('[Notifications] 通知失敗:', error);
                sendResponse({ status: 'error', error: error.message });
            });
        return true;  // 保持通道開放以進行異步回應
    }
});