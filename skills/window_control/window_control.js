/**
 * Window Control Skill - Control browser window fullscreen mode
 * Executes in SidePanel context using Document Fullscreen API
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

    // 獲取當前活動標籤頁
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error("找不到活動的標籤頁");
    }

    const tabId = tabs[0].id;
    console.log(`[Window Control Skill] 目標標籤頁 ID: ${tabId}`);

    // 根據模式執行全螢幕控制
    switch (mode.toLowerCase()) {
      case 'enter':
        console.log("[Window Control Skill] 進入全螢幕模式");
        
        // 使用 Document Fullscreen API
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          function: () => {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
              elem.requestFullscreen().catch(err => {
                console.error("[Window Control] 全螢幕請求失敗:", err);
              });
            } else if (elem.mozRequestFullScreen) {
              elem.mozRequestFullScreen();
            } else if (elem.webkitRequestFullscreen) {
              elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
              elem.msRequestFullscreen();
            }
          }
        });
        
        return "✅ 已進入全螢幕模式";

      case 'exit':
        console.log("[Window Control Skill] 退出全螢幕模式");
        
        // 退出全螢幕
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          function: () => {
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(err => {
                console.error("[Window Control] 退出全螢幕失敗:", err);
              });
            } else if (document.mozFullScreenElement) {
              document.mozCancelFullScreen();
            } else if (document.webkitFullscreenElement) {
              document.webkitExitFullscreen();
            } else if (document.msFullscreenElement) {
              document.msExitFullscreen();
            }
          }
        });
        
        return "✅ 已退出全螢幕模式";

      case 'toggle':
        console.log("[Window Control Skill] 切換全螢幕模式");
        
        // 切換全螢幕
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          function: () => {
            const elem = document.documentElement;
            
            if (document.fullscreenElement ||
                document.mozFullScreenElement ||
                document.webkitFullscreenElement ||
                document.msFullscreenElement) {
              // 已在全螢幕，退出
              if (document.exitFullscreen) {
                document.exitFullscreen().catch(err => {
                  console.error("[Window Control] 退出全螢幕失敗:", err);
                });
              } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
              } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
              } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
              }
            } else {
              // 未在全螢幕，進入
              if (elem.requestFullscreen) {
                elem.requestFullscreen().catch(err => {
                  console.error("[Window Control] 全螢幕請求失敗:", err);
                });
              } else if (elem.mozRequestFullScreen) {
                elem.mozRequestFullScreen();
              } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
              } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
              }
            }
          }
        });
        
        return "✅ 已切換全螢幕模式";

      default:
        throw new Error(`未知的全螢幕模式: ${mode}`);
    }
  } catch (error) {
    console.error("[Window Control Skill] 錯誤:", error);
    throw new Error(`全螢幕控制失敗：${error.message}`);
  }
}
