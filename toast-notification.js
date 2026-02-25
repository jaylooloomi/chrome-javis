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
        bottom: 20px;
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
function showToast(type, title, message, duration = 10000) {
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
            align-items: center;
            gap: 12px;
            min-width: 280px;
            max-width: 400px;
            padding: 14px 16px;
            background-color: ${bgColor};
            color: white;
            border-left: 4px solid ${borderColor};
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            font-family: 'Microsoft JhengHei', 'Segoe UI', sans-serif;
            font-size: 14px;
            pointer-events: auto;
            animation: slideInRight 0.3s ease-out;
            cursor: pointer;
            transition: transform 0.3s, opacity 0.3s;
        `;
        
        // 添加內容
        toast.innerHTML = `
            <span style="font-size: 18px; min-width: 24px; text-align: center;">${icon}</span>
            <div style="flex: 1;">
                <div style="font-weight: bold; margin-bottom: 4px;">${title}</div>
                <div style="font-size: 13px; opacity: 0.95;">${message}</div>
            </div>
            <button id="close-${toastId}" style="
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
            ">✕</button>
        `;
        
        // 添加樣式表（如果尚未添加）
        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(400px);
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
        const closeBtn = document.getElementById(`close-${toastId}`);
        closeBtn.addEventListener('click', () => {
            removeToast(toastId);
        });
        
        // 鼠標懸停時增加亮度
        toast.addEventListener('mouseenter', () => {
            toast.style.transform = 'scale(1.02)';
            toast.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
        });
        
        toast.addEventListener('mouseleave', () => {
            toast.style.transform = 'scale(1)';
            toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
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
    
    toast.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => {
        toast.remove();
        console.log('[Toast] 已移除:', toastId);
    }, 300);
}

/**
 * 顯示成功通知
 */
function showSuccessToast(title, message, duration = 10000) {
    return showToast('success', title, message, duration);
}

/**
 * 顯示失敗通知
 */
function showErrorToast(title, message, duration = 10000) {
    return showToast('error', title, message, duration);
}

/**
 * 顯示信息通知
 */
function showInfoToast(title, message, duration = 10000) {
    return showToast('info', title, message, duration);
}

// 導出函數
export { showToast, showSuccessToast, showErrorToast, showInfoToast };
