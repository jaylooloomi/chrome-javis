/**
 * 统一的通知工具函数
 * 支持成功、失败、信息三种类型
 */

// 通知图标配置（保留 iconUrl 字段便于后续更换为贾维斯头像）
const NOTIFICATION_CONFIG = {
    iconUrl: '/images/icon-128.png',  // 可更换为贾维斯头像
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
        if (settings.notificationsEnabled === false) {
            console.log('[Notifications] 用户已关闭通知');
            return;
        }

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

        // 创建通知
        await chrome.notifications.create(notificationId, {
            type: 'basic',
            iconUrl: NOTIFICATION_CONFIG.iconUrl,
            title: title,
            message: message,
            priority: 2,
            requireInteraction: false  // 不要求用户交互
        });

        console.log('[Notifications] 已显示通知:', { type, skillName, message });

        // 2秒后自动关闭通知
        setTimeout(() => {
            chrome.notifications.clear(notificationId, () => {
                console.log('[Notifications] 通知已自动关闭');
            });
        }, 2000);

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