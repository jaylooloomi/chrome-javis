// settings.js - 設定頁面的頁籤切換邏輯

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
}

// ========== 初始化 ==========

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Settings] 初始化設定頁面');
    // 頁籤已在 HTML 中綁定了
});

