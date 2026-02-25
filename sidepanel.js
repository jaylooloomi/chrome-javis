// ======== 導入通知工具 ========
import { showSuccessToast, showErrorToast, showInfoToast } from './toast-notification.js';
import i18n from './i18n/i18n.js';

// ======== 創建 i18n 初始化 Promise ========
let i18nReady = Promise.resolve();

// ======== i18n 翻譯應用函數 ========
function applyTranslations() {
    // 應用所有 data-i18n 屬性
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = i18n.t(key);
    });

    // 應用所有 data-i18n-placeholder 屬性
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = i18n.t(key);
    });

    // 應用所有 data-i18n-title 屬性
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        element.title = i18n.t(key);
    });

    console.log('[SidePanel] i18n 翻譯已應用');
}

// ======== 初始化 i18n ========
i18nReady = (async () => {
    await i18n.load();
    console.log('[SidePanel] i18n 初始化完成');
    applyTranslations();
    
    // 監聽 i18n 語言變更
    i18n.onLanguageChange(() => {
        applyTranslations();
        updateMicSwitchUI();
        updateConfigStatus();
    });
})();

// ======== 語音識別初始化 (直接使用 Web Speech API) ========
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
let final_transcript = '';
let interim_transcript = '';
let isAutoRunning = false;  // 標記是否在自動執行流程中
let isMicEnabled = true;    // 常駐麥克風狀態 (預設開啟)
let speechStartCount = 0;   // 累計 onstart 的次數
let currentMicLanguage = 'zh-TW';  // 當前麥克風語言

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;  // 顯示實時轉錄文本
    
    // 從 storage 加載語言設定
    chrome.storage.sync.get('micLanguage', (result) => {
        const language = result.micLanguage || 'zh-TW';
        currentMicLanguage = language;
        recognition.lang = language;
        console.log('[SidePanel] 麥克風語言已加載:', language);
    });

    recognition.onstart = () => {
        console.log("[Speech] 語音識別已啟動");
        isListening = true;
        document.getElementById('output').textContent = i18n.t('status.listening.indicator');
        
        // 累計 onstart 次數，每 5 次才顯示一次 toast
        speechStartCount++;
        if (speechStartCount % 2 === 0) {
            // 暫時註解不要刪除
            //showInfoToast('🎤 語音助手', '正在聆聽...');  // 不自動關閉
        }
        console.log(`[Speech] onstart 累計次數: ${speechStartCount}`);
        
        final_transcript = '';
        interim_transcript = '';
    };

    recognition.onend = () => {
        console.log("[Speech] 語音識別已停止");
        isListening = false;
        
        // 如果常駐麥克風已關閉，則不自動重啟
        if (!isMicEnabled) {
            console.log("[Speech] 常駐麥克風已關閉");
            return;
        }
        
        // 識別結束後等待 0.5s，檢查是否有內容需要執行
        const text = final_transcript.trim();
        if (text && !isAutoRunning) {
            console.log("[Speech] 停顿 0.5s 后自动执行:", text);
            isAutoRunning = true;
            setTimeout(() => {
                document.getElementById('runBtn').click();
                // 执行后重新启动常驻麦克风
                setTimeout(() => {
                    if (isMicEnabled) {
                        console.log("[Speech] 重新启动常驻麦克风");
                        recognition.start();
                    }
                    isAutoRunning = false;
                }, 0);
            }, 0); // 停顿 0.5s
        } else if (!text && isMicEnabled) {
            // 没有识别到内容，继续监听
            console.log("[Speech] 未识别到内容，继续监听");
            setTimeout(() => {
                recognition.start();
            }, 300);
        }
    };

    recognition.onresult = (event) => {
        interim_transcript = '';
        
        // 分離最終結果和臨時結果
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
                final_transcript += transcript + ' ';
                console.log("[Speech] 最終結果:", transcript);
            } else {
                interim_transcript += transcript;
                console.log("[Speech] 臨時結果:", transcript);
            }
        }

        // 在 textarea 中顯示識別結果
        const userInput = document.getElementById('userInput');
        userInput.value = final_transcript + interim_transcript;
    };

    recognition.onerror = (event) => {
        console.error("[Speech] 錯誤:", event.error);
        
        let errorMsg = event.error;
        if (event.error === 'no-speech') {
            errorMsg = '未检测到语音，请检查麦克风';
        } else if (event.error === 'audio-capture') {
            errorMsg = '未找到麦克风设备';
        } else if (event.error === 'not-allowed') {
            errorMsg = '麦克风权限被拒绝';
        } else if (event.error === 'network') {
            errorMsg = '网络连接错误';
        }
        
        // 权限被拒绝时，提供打开选项页面的按钮
        if (event.error === 'not-allowed') {
            const output = document.getElementById('output');
            output.innerHTML = `
                <div style="color: #d32f2f;">
                    ❌ 麦克风权限被拒绝<br/>
                    <small style="margin-top: 8px; display: block;">
                        请在扩展选项中授予权限
                    </small>
                </div>
            `;
            const btn = document.createElement('button');
            btn.textContent = i18n.t('button.options');
            btn.style.cssText = 'margin-top: 10px; padding: 8px 16px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;';
            btn.onclick = () => {
                chrome.runtime.openOptionsPage();
            };
            output.appendChild(btn);
        } else {
            // 暫時註解不要刪除
            //showErrorToast('❌ 語音錯誤', errorMsg);
            document.getElementById('output').textContent = i18n.t('status.speech.error') + ': ' + errorMsg;
        }
        
        isListening = false;
        updateMicSwitchUI();
    };
} else {
    console.warn("[Speech] 您的浏览器不支持 Web Speech API");
    document.getElementById('micSwitch').disabled = true;
    document.getElementById('micSwitch').title = '您的浏览器不支持语音识别';
}

// ======== 監聽語言設定變更 ========
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.micLanguage) {
        const newLanguage = changes.micLanguage.newValue;
        currentMicLanguage = newLanguage;
        if (recognition) {
            recognition.lang = newLanguage;
            console.log('[SidePanel] 麥克風語言已更新:', newLanguage);
        }
    }
});

// ======== 更新麥克風開關 UI ========
function updateMicSwitchUI() {
    const switchBtn = document.getElementById('micSwitch');
    const statusLabel = document.getElementById('micStatus');
    
    if (!switchBtn || !statusLabel) {
        console.warn('[SidePanel] 麥克風開關元素未找到');
        return;
    }
    
    if (!i18n.isLoaded) {
        console.warn('[SidePanel] i18n 還未初始化，跳過 updateMicSwitchUI');
        return;
    }
    
    if (isMicEnabled) {
        switchBtn.classList.add('on');
        statusLabel.textContent = i18n.t('button.mic');
    } else {
        switchBtn.classList.remove('on');
        statusLabel.textContent = i18n.t('button.mic.off');
    }
}

// ======== 麥克風開關事件 ========
document.getElementById('micSwitch').addEventListener('click', () => {
    if (!recognition) {
        alert('您的浏览器不支持语音识别');
        return;
    }

    // 切換常駐麥克風狀態
    isMicEnabled = !isMicEnabled;
    console.log("[Speech] 常駐麥克風狀態:", isMicEnabled ? "開啟" : "關閉");
    
    // 更新配置狀態文字
    const configStatus = document.querySelector('.config-status');
    const listeningStatus = document.getElementById('listeningStatus');
    
    if (isMicEnabled) {
        // 開啟常駐麥克風
        updateMicSwitchUI();
        document.getElementById('output').textContent = i18n.t('status.ready');
        
        // 更新配置狀態
        if (configStatus) {
            configStatus.textContent = i18n.t('config.status');
        }
        if (listeningStatus) {
            listeningStatus.textContent = i18n.t('status.listening');
        }
        
        console.log("[Speech] 開始常駐監聽");
        recognition.start();
    } else {
        // 關閉常駐麥克風
        updateMicSwitchUI();
        document.getElementById('output').textContent = i18n.t('status.closed');
        
        // 更新配置狀態
        if (configStatus) {
            configStatus.textContent = i18n.t('config.status.disabled');
        }
        if (listeningStatus) {
            listeningStatus.textContent = i18n.t('status.idle');
        }
        
        console.log("[Speech] 停止常駐監聽");
        recognition.stop();
    }
});

document.getElementById('runBtn').addEventListener('click', async () => {
    const text = document.getElementById('userInput').value;
    const output = document.getElementById('output');
    
    if (!text) return;
    
    output.textContent = i18n.t('status.processing');
    
    try {
        // 從 config.json 讀取完整配置
        const configResponse = await fetch(chrome.runtime.getURL('config.json'));
        const config = await configResponse.json();
        
        console.log("[SidePanel] 準備發送訊息");
        console.log("[SidePanel] 用戶輸入:", text);
        console.log("[SidePanel] activeModel:", config.activeModel);
        console.log("[SidePanel] 完整 config:", JSON.stringify(config, null, 2));
        
        const message = { 
            action: "ask_ai", 
            prompt: text,
            config: config
        };
        
        console.log("[SidePanel] 發送的訊息:", JSON.stringify(message, null, 2));
        
        const res = await chrome.runtime.sendMessage(message);
        console.log("[SidePanel] 收到回應:", res);
        output.textContent = res.text || res.error;
        
        // 顯示通知 - 執行成功
        if (res.status === "success") {
            console.log("[SidePanel] 執行成功，顯示成功通知");
            document.getElementById('userInput').value = '';
            final_transcript = '';
            interim_transcript = '';
            // 暫時註解不要刪除
            //await showSuccessToast('✅ AI 助手', '指令已執行');
            
        } else {
            // 顯示通知 - 執行失敗
            console.log("[SidePanel] 執行失敗，顯示錯誤通知");
            await showErrorToast('❌ AI 助手', res.error || '執行失敗');
        }
    } catch (error) {
        console.error("[SidePanel] 錯誤:", error);
        output.textContent = `❌ 錯誤: ${error.message}`;
    }
});

// ======== 技能執行監聽 (SidePanel 作為技能執行中心) ========
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target === 'SIDE_PANEL' && message.type === 'EXECUTE_SKILL') {
        console.log("[SidePanel] 收到技能執行請求:", message.skill, message.args);
        
        // 異步處理技能執行
        (async () => {
            try {
                // 動態 import 技能模組
                const skillPath = `./skills/${message.skillFolder}/${message.skill}.js`;
                console.log(`[SidePanel] 正在加載技能模組: ${skillPath}`);
                
                const module = await import(skillPath);
                
                // 執行技能函數
                const skillFunc = module[message.skill];
                if (typeof skillFunc !== 'function') {
                    throw new Error(`技能模組中未找到函數: ${message.skill}`);
                }
                
                console.log(`[SidePanel] 執行技能: ${message.skill}`);
                const result = await skillFunc(message.args);
                
                console.log(`[SidePanel] 技能執行成功:`, result);
                // 顯示成功通知
                await showSuccessToast(message.skill, '技能已成功執行');
                sendResponse({ status: "success", result: result });
                
            } catch (error) {
                console.error(`[SidePanel] 技能執行失敗:`, error);
                // 顯示錯誤通知
                await showErrorToast(message.skill, error.message);
                sendResponse({ status: "error", error: error.message });
            }
        })();
        
        // 必須返回 true 以保持消息通道開啟，直到異步 sendResponse 被調用
        return true;
    }
});

// ======== Ask Gemini 按鈕事件 ========
document.getElementById('askGeminiBtn').addEventListener('click', async () => {
    console.log("[SidePanel] Ask Gemini 按鈕被點擊");
    
    try {
        // 都透過skills執行, 不走這裡了, 但先不刪除
        
    } catch (error) {
        console.error("[SidePanel] Summary Page 失敗:", error);
        document.getElementById('output').textContent = i18n.t('error.summary.page') + '：' + error.message;
    }
});

// ======== 贊助按鈕點擊事件 ========
document.getElementById('sponsorBtn').addEventListener('click', () => {
    chrome.tabs.create({
        url: 'https://buymeacoffee.com/arthurwang'
    });
});

// ======== 系統訊息對話框關閉按鈕 ========
document.querySelector('.close-btn').addEventListener('click', () => {
    const topInnerPanel = document.querySelector('.top-inner-panel-container');
    topInnerPanel.style.display = 'none';
    console.log('[SidePanel] 系統訊息對話框已關閉');
});

// ======== 更新配置狀態文字 ========
function updateConfigStatus() {
    const configStatus = document.querySelector('.config-status');
    if (!configStatus) {
        console.warn('[SidePanel] config-status 元素未找到');
        return;
    }
    
    if (!i18n.isLoaded) {
        console.warn('[SidePanel] i18n 還未初始化，跳過 updateConfigStatus');
        return;
    }
    
    if (isMicEnabled) {
        configStatus.textContent = i18n.t('config.status');
    } else {
        configStatus.textContent = i18n.t('config.status.disabled');
    }
}

// ======== 頁面加載完成後自動啟動常駐麥克風 ========
document.addEventListener('DOMContentLoaded', async () => {
    // 等待 i18n 初始化完成
    try {
        await i18nReady;
        console.log('[SidePanel] i18nReady Promise 已完成');
    } catch (error) {
        console.error('[SidePanel] i18n 初始化失敗:', error);
    }
    
    // 更新開關 UI 初始狀態
    if (i18n.isLoaded) {
        updateMicSwitchUI();
    } else {
        console.warn('[SidePanel] DOMContentLoaded 時 i18n 還未加載');
    }
    
    if (recognition && isMicEnabled) {
        console.log("[Speech] 頁面載入，自動啟動常駐麥克風");
        recognition.start();
    }
});