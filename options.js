// options.js - 設定頁面的頁籤切換邏輯

console.log('[Options] 設定頁面已加載');

// ========== i18n 初始化 ==========
async function initializeI18n() {
    try {
        await i18n.load('options');
        console.log('[Options] i18n 已加載');
        
        // 應用翻譯到 DOM 元素
        applyI18nTranslations();
    } catch (error) {
        console.error('[Options] i18n 加載失敗:', error);
    }
}

function applyI18nTranslations() {
    // 找到所有帶有 data-i18n 屬性的元素
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = i18n.t(key);
        if (translation) {
            element.textContent = translation;
        }
    });
    
    // 處理 placeholder 翻譯
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        const translation = i18n.t(key);
        if (translation) {
            element.placeholder = translation;
        }
    });
}

// 監聽語言變化
i18n.onLanguageChange(() => {
    applyI18nTranslations();
});

// ========== 頁籤切換邏輯 ==========

/**
 * 切換頁籤
 */
function switchTab(tabName) {
    console.log(`[Options] 切換到頁籤: ${tabName}`);
    
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
}

// ========== 初始化 ==========

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Options] 初始化設定頁面');
    await initializeI18n();
    
    // 綁定頁籤按鈕點擊事件（在 DOM 準備好後執行）
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const tabName = e.target.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
});

