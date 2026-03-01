/**
 * 現代化 Toast 通知系統
 * 毛玻璃風格 + 科技感左邊框
 */

// ======== 初始化 Toast 容器 ========
function initToastContainer() {
    if (document.getElementById('toast-container')) {
        return;
    }

    const container = document.createElement('div');
    container.id = 'toast-container';
    
    // 注入樣式
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            }

            /* ======== Toast 項目 ======== */
            .toast-item {
                /* 毛玻璃背景 */
                background: rgba(15, 23, 42, 0.8);
                backdrop-filter: blur(10px);
                
                /* 科技感細邊框 */
                border-left: 4px solid #4ade80;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                border-right: 1px solid rgba(255, 255, 255, 0.1);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                
                border-radius: 8px;
                padding: 12px 16px;
                min-width: 280px;
                max-width: 350px;
                
                /* 外發光效果 */
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3), 0 0 10px rgba(74, 222, 128, 0.1);
                
                display: flex;
                align-items: flex-start;
                gap: 12px;
                
                /* 動畫 */
                animation: slideIn 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
                pointer-events: auto;
            }

            /* ======== 成功樣式 ======== */
            .toast-item.success {
                border-left-color: #4ade80;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3), 0 0 10px rgba(74, 222, 128, 0.1);
            }

            .toast-item.success .toast-title {
                color: #4ade80;
            }

            /* ======== 失敗樣式 ======== */
            .toast-item.error {
                border-left-color: #ef4444;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3), 0 0 10px rgba(239, 68, 68, 0.1);
            }

            .toast-item.error .toast-title {
                color: #ef4444;
            }

            /* ======== 信息樣式 ======== */
            .toast-item.info {
                border-left-color: #3b82f6;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3), 0 0 10px rgba(59, 130, 246, 0.1);
            }

            .toast-item.info .toast-title {
                color: #3b82f6;
            }

            /* ======== Toast 內容 ======== */
            .toast-content {
                display: flex;
                flex-direction: column;
                flex: 1;
            }

            .toast-icon {
                font-size: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }

            .toast-title {
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                margin-bottom: 4px;
            }

            .toast-message {
                color: #cbd5e1;
                font-size: 12px;
                line-height: 1.4;
                word-break: break-word;
            }

            /* ======== 關閉按鈕 ======== */
            .toast-close {
                background: none;
                border: none;
                color: #94a3b8;
                font-size: 16px;
                cursor: pointer;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                transition: color 0.2s ease;
            }

            .toast-close:hover {
                color: #cbd5e1;
            }

            /* ======== 進入動畫 ======== */
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateX(50px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            /* ======== 退出動畫 ======== */
            @keyframes slideOut {
                from {
                    opacity: 1;
                    transform: translateX(0);
                }
                to {
                    opacity: 0;
                    transform: translateX(50px);
                }
            }

            .toast-item.exiting {
                animation: slideOut 0.3s cubic-bezier(0.36, 0, 0.66, -0.56) forwards;
            }
        `;
        document.head.appendChild(style);
    }

    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
    console.log('[Toast] 容器已初始化');
}

// ======== 建立 Toast ========
function createToast(title, message, type = 'info') {
    initToastContainer();

    const container = document.getElementById('toast-container');

    // 建立 toast 元素
    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;

    // 圖標映射
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || '📢'}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close">✕</button>
    `;

    container.appendChild(toast);
    container.style.pointerEvents = 'auto';

    // 關閉按鈕事件
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        removeToast(toast);
    });

    // 自動關閉
    const timeoutId = setTimeout(() => {
        removeToast(toast);
    }, 6000);

    // 懸停時暫停自動關閉
    toast.addEventListener('mouseenter', () => {
        clearTimeout(timeoutId);
    });

    toast.addEventListener('mouseleave', () => {
        setTimeout(() => {
            removeToast(toast);
        }, 2000);
    });

    console.log(`[Toast] ${type.toUpperCase()} - ${title}: ${message}`);
}

// ======== 移除 Toast ========
function removeToast(toast) {
    if (!toast.classList.contains('exiting')) {
        toast.classList.add('exiting');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }
}

// ======== 公開 API ========
export function showSuccessToast(title, message) {
    createToast(title, message, 'success');
}

export function showErrorToast(title, message) {
    createToast(title, message, 'error');
}

export function showInfoToast(title, message) {
    createToast(title, message, 'info');
}
