/**
 * Window Control Skill - Control browser window fullscreen mode
 * Executes in SidePanel context using Chrome Windows API
 * Controls the browser window's fullscreen state (not webpage fullscreen)
 */

export async function window_control(args) {
  console.log("[Window Control Skill] 啟動，接收到參數:", args);

  try {
    const mode = args.mode;

    if (!mode) {
      throw new Error("未提供全螢幕控制模式 (mode)");
    }

    // 驗證模式值
    const validModes = ['enter', 'exit', 'toggle'];
    if (!validModes.includes(mode.toLowerCase())) {
      throw new Error(`無效的全螢幕模式: ${mode}。必須是: ${validModes.join(', ')}`);
    }

    // 獲取當前活動窗口
    const currentWindow = await chrome.windows.getCurrent();
    if (!currentWindow) {
      throw new Error("找不到當前瀏覽器窗口");
    }

    const windowId = currentWindow.id;
    const currentState = currentWindow.state;
    
    console.log(`[Window Control Skill] 當前窗口 ID: ${windowId}，狀態: ${currentState}`);

    // 根據模式執行全螢幕控制
    switch (mode.toLowerCase()) {
      case 'enter':
        console.log("[Window Control Skill] 進入全螢幕模式");
        
        // 使用 Chrome Windows API 進入全螢幕
        await chrome.windows.update(windowId, { state: 'fullscreen' });
        
        return "✅ 已進入全螢幕模式";

      case 'exit':
        console.log("[Window Control Skill] 退出全螢幕模式");
        
        // 退出全螢幕，恢復為正常狀態
        await chrome.windows.update(windowId, { state: 'normal' });
        
        return "✅ 已退出全螢幕模式";

      case 'toggle':
        console.log("[Window Control Skill] 切換全螢幕模式");
        
        // 根據當前狀態進行切換
        const newState = (currentState === 'fullscreen') ? 'normal' : 'fullscreen';
        await chrome.windows.update(windowId, { state: newState });
        
        if (newState === 'fullscreen') {
          return "✅ 已進入全螢幕模式";
        } else {
          return "✅ 已退出全螢幕模式";
        }

      default:
        throw new Error(`未知的全螢幕模式: ${mode}`);
    }
  } catch (error) {
    console.error("[Window Control Skill] 錯誤:", error);
    throw new Error(`全螢幕控制失敗：${error.message}`);
  }
}
