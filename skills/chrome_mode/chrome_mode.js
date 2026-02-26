/**
 * Chrome Mode Skill - Control webpage theme mode (dark/light)
 * Executes in page context using prefers-color-scheme media query
 * Detects and applies CSS-based theme switching
 */

export async function chrome_mode(args) {
  console.log("[Chrome Mode Skill] 啟動，接收到參數:", args);

  try {
    const mode = args.mode;

    if (!mode) {
      throw new Error("未提供主題模式 (mode)");
    }

    // 驗證模式值
    const validModes = ['dark', 'light'];
    if (!validModes.includes(mode.toLowerCase())) {
      throw new Error(`無效的主題模式: ${mode}。必須是: ${validModes.join(', ')}`);
    }

    const requestedMode = mode.toLowerCase();
    
    // 檢測當前系統主題偏好
    const isDarkModePreferred = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const currentMode = isDarkModePreferred ? 'dark' : 'light';
    
    console.log(`[Chrome Mode Skill] 當前系統主題: ${currentMode}，請求主題: ${requestedMode}`);

    // 根據模式應用主題
    switch (requestedMode) {
      case 'dark':
        console.log("[Chrome Mode Skill] 應用深色模式");
        applyDarkMode();
        return `✅ 已切換為深色模式`;

      case 'light':
        console.log("[Chrome Mode Skill] 應用淺色模式");
        applyLightMode();
        return `✅ 已切換為淺色模式`;

      default:
        throw new Error(`未知的主題模式: ${mode}`);
    }
  } catch (error) {
    console.error("[Chrome Mode Skill] 錯誤:", error);
    throw new Error(`主題切換失敗：${error.message}`);
  }
}

/**
 * 應用深色模式
 * 嘗試多種方式來切換網站主題
 */
function applyDarkMode() {
  // 方法 1: 設置 data-theme 屬性（許多現代網站使用這種方式）
  document.documentElement.setAttribute('data-theme', 'dark');
  document.documentElement.setAttribute('data-color-scheme', 'dark');
  
  // 方法 2: 設置 color-scheme CSS 屬性
  document.documentElement.style.colorScheme = 'dark';
  
  // 方法 3: 為 body 添加 dark 類名
  document.body.classList.add('dark-mode', 'dark-theme', 'dark');
  document.body.classList.remove('light-mode', 'light-theme', 'light');
  
  // 方法 4: 查找並觸發主題切換按鈕（如果存在）
  triggerThemeToggle('dark');
  
  // 方法 5: 嘗試修改 localStorage（許多網站用這個保存主題偏好）
  try {
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('color-scheme', 'dark');
    localStorage.setItem('darkMode', 'true');
    localStorage.setItem('mode', 'dark');
  } catch (e) {
    console.warn("[Chrome Mode Skill] 無法訪問 localStorage");
  }
  
  console.log("[Chrome Mode Skill] 深色模式應用完成");
}

/**
 * 應用淺色模式
 * 嘗試多種方式來切換網站主題
 */
function applyLightMode() {
  // 方法 1: 設置 data-theme 屬性（許多現代網站使用這種方式）
  document.documentElement.setAttribute('data-theme', 'light');
  document.documentElement.setAttribute('data-color-scheme', 'light');
  
  // 方法 2: 設置 color-scheme CSS 屬性
  document.documentElement.style.colorScheme = 'light';
  
  // 方法 3: 為 body 添加 light 類名
  document.body.classList.add('light-mode', 'light-theme', 'light');
  document.body.classList.remove('dark-mode', 'dark-theme', 'dark');
  
  // 方法 4: 查找並觸發主題切換按鈕（如果存在）
  triggerThemeToggle('light');
  
  // 方法 5: 嘗試修改 localStorage（許多網站用這個保存主題偏好）
  try {
    localStorage.setItem('theme', 'light');
    localStorage.setItem('color-scheme', 'light');
    localStorage.setItem('darkMode', 'false');
    localStorage.setItem('mode', 'light');
  } catch (e) {
    console.warn("[Chrome Mode Skill] 無法訪問 localStorage");
  }
  
  console.log("[Chrome Mode Skill] 淺色模式應用完成");
}

/**
 * 嘗試查找並觸發主題切換按鈕
 * 支持常見的主題切換按鈕選擇器
 */
function triggerThemeToggle(targetMode) {
  // 常見的主題切換按鈕選擇器
  const toggleSelectors = [
    '[aria-label*="theme"]',
    '[aria-label*="dark"]',
    '[aria-label*="light"]',
    '[title*="theme"]',
    '[title*="dark"]',
    '[title*="light"]',
    '.theme-toggle',
    '.dark-toggle',
    '.light-toggle',
    '#theme-toggle',
    '.theme-switcher',
    '[data-action="toggle-theme"]',
  ];
  
  for (const selector of toggleSelectors) {
    const button = document.querySelector(selector);
    if (button) {
      console.log(`[Chrome Mode Skill] 找到主題切換按鈕: ${selector}`);
      
      // 檢查按鈕當前狀態，只在需要時點擊
      const ariaPressed = button.getAttribute('aria-pressed');
      const ariaLabel = button.getAttribute('aria-label') || '';
      
      // 判斷是否需要點擊
      let shouldClick = false;
      if (targetMode === 'dark' && ariaLabel.toLowerCase().includes('dark') && ariaPressed === 'false') {
        shouldClick = true;
      } else if (targetMode === 'light' && ariaLabel.toLowerCase().includes('light') && ariaPressed === 'false') {
        shouldClick = true;
      } else if (!ariaPressed) {
        // 如果沒有 aria-pressed，就嘗試點擊
        shouldClick = true;
      }
      
      if (shouldClick) {
        button.click();
        console.log(`[Chrome Mode Skill] 已點擊主題切換按鈕`);
        return;
      }
    }
  }
  
  console.log("[Chrome Mode Skill] 未找到主題切換按鈕");
}
