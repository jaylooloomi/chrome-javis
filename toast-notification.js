/**
 * 自定義 HTML Toast 通知系統
 * 在 SidePanel 右下角顯示通知氣泡
 */

// 初始化 toast 容器
function initToastContainer() {
    if (document.getElementById('toast-container')) {
        return;  // 已存在，無需重複初始化
    }
    
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 10000;
        pointer-events: none;
    `;
    document.body.appendChild(container);
    
    console.log('[Toast] 容器已初始化');
}

/**
 * 顯示 Toast 通知
 * @param {string} type - 通知類型: 'success' | 'error' | 'info'
 * @param {string} title - 通知標題
 * @param {string} message - 通知訊息
 * @param {number} duration - 顯示時長（毫秒），0 表示不自動關閉
 */
function showToast(type, title, message, duration = 3000) {
    try {
        initToastContainer();
        
        // 設定顏色和圖標
        let bgColor, borderColor, icon;
        switch (type) {
            case 'success':
                bgColor = '#4CAF50';
                borderColor = '#2E7D32';
                icon = '✅';
                break;
            case 'error':
                bgColor = '#F44336';
                borderColor = '#C62828';
                icon = '❌';
                break;
            case 'info':
                bgColor = '#2196F3';
                borderColor = '#1565C0';
                icon = 'ℹ️';
                break;
            default:
                bgColor = '#757575';
                borderColor = '#424242';
                icon = '📢';
        }
        
        // 創建 toast 元素
        const toast = document.createElement('div');
        const toastId = `toast-${Date.now()}`;
        toast.id = toastId;
        toast.style.cssText = `
            display: flex;
            align-items: flex-end;
            gap: 12px;
            min-width: 300px;
            max-width: 450px;
            pointer-events: auto;
            animation: slideInDown 0.3s ease-out;
            cursor: pointer;
        `;
        
        // 添加內容（氣泡樣式）
        const bubbleContent = document.createElement('div');
        bubbleContent.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 14px 16px;
            background-color: ${bgColor};
            color: white;
            border-radius: 16px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            font-family: 'Microsoft JhengHei', 'Segoe UI', sans-serif;
            font-size: 14px;
            transition: transform 0.3s, opacity 0.3s;
            position: relative;
        `;
        
        // 添加氣泡尖角（三角形）
        bubbleContent.innerHTML = `
            <div style="font-weight: bold;">${title}</div>
            <div style="font-size: 13px; opacity: 0.95;">${message}</div>
            <div style="
                position: absolute;
                bottom: -8px;
                right: 16px;
                width: 0;
                height: 0;
                border-left: 8px solid transparent;
                border-top: 8px solid ${bgColor};
            "></div>
        `;
        
        toast.appendChild(bubbleContent);
        
        // 添加頭像
        const avatar = document.createElement('img');
        avatar.src = chrome.runtime.getURL('images/jarvis_pixian_ai.png');
        avatar.style.cssText = `
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background-color: white;
            padding: 2px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        `;
        toast.appendChild(avatar);
        
        // 添加關閉按鈕（在氣泡內部）
        const closeBtn = document.createElement('button');
        closeBtn.id = `close-${toastId}`;
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            position: absolute;
            top: 4px;
            right: 4px;
            background: rgba(255, 255, 255, 0.3);
            border: none;
            color: white;
            cursor: pointer;
            font-size: 16px;
            width: 24px;
            height: 24px;
            padding: 0;
            border-radius: 4px;
            transition: background 0.2s;
            display: none;
        `;
        bubbleContent.style.position = 'relative';
        bubbleContent.appendChild(closeBtn);
        
        // 鼠標懸停時顯示關閉按鈕
        toast.addEventListener('mouseenter', () => {
            closeBtn.style.display = 'block';
            bubbleContent.style.transform = 'scale(1.02)';
            bubbleContent.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
        });
        
        toast.addEventListener('mouseleave', () => {
            closeBtn.style.display = 'none';
            bubbleContent.style.transform = 'scale(1)';
            bubbleContent.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        });
        
        // 添加樣式表（如果尚未添加）
        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                @keyframes slideInDown {
                    from {
                        transform: translateY(-400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                
                @keyframes slideOutUp {
                    from {
                        transform: translateY(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateY(-400px);
                        opacity: 0;
                    }
                }
                
                #toast-container:hover button {
                    background: rgba(255, 255, 255, 0.5) !important;
                }
            `;
            document.head.appendChild(style);
        }
        
        const container = document.getElementById('toast-container');
        container.appendChild(toast);
        
        console.log('[Toast] ✅ 已顯示:', { type, title, toastId });
        
        // 關閉按鈕事件
        closeBtn.addEventListener('click', () => {
            removeToast(toastId);
        });
        
        // 自動關閉
        if (duration > 0) {
            setTimeout(() => {
                removeToast(toastId);
            }, duration);
        }
        
    } catch (error) {
        console.error('[Toast] 顯示失敗:', error);
    }
}

/**
 * 移除 Toast 通知
 */
function removeToast(toastId) {
    const toast = document.getElementById(toastId);
    if (!toast) return;
    
    toast.style.animation = 'slideOutUp 0.3s ease-out';
    setTimeout(() => {
        toast.remove();
        console.log('[Toast] 已移除:', toastId);
    }, 300);
}

/**
 * 顯示成功通知
 */
function showSuccessToast(title, message, duration = 3000) {
    return showToast('success', title, message, duration);
}

/**
 * 顯示失敗通知
 */
function showErrorToast(title, message, duration = 3000) {
    return showToast('error', title, message, duration);
}

/**
 * 顯示信息通知
 */
function showInfoToast(title, message, duration = 3000) {
    return showToast('info', title, message, duration);
}

// 導出函數
export { showToast, showSuccessToast, showErrorToast, showInfoToast };
