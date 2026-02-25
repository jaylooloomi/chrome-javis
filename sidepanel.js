// ======== 語音識別初始化 (直接使用 Web Speech API) ========
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
let final_transcript = '';
let interim_transcript = '';
let isAutoRunning = false;  // 標記是否在自動執行流程中
let isMicEnabled = true;    // 常駐麥克風狀態 (預設開啟)

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;  // 顯示實時轉錄文本
    recognition.lang = 'zh-TW';

    recognition.onstart = () => {
        console.log("[Speech] 語音識別已啟動");
        isListening = true;
        document.getElementById('micBtn').classList.add('listening');
        document.getElementById('micBtn').textContent = '⏹️';
        document.getElementById('output').textContent = '🎤 正在聆聽...';
        final_transcript = '';
        interim_transcript = '';
    };

    recognition.onend = () => {
        console.log("[Speech] 語音識別已停止");
        isListening = false;
        document.getElementById('micBtn').classList.remove('listening');
        
        // 更新按鈕顯示
        if (isMicEnabled) {
            document.getElementById('micBtn').textContent = '🎤';
        } else {
            document.getElementById('micBtn').textContent = '🔇';
        }
        
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
                }, 500);
            }, 500); // 停顿 0.5s
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
            btn.textContent = '打开选项页面';
            btn.style.cssText = 'margin-top: 10px; padding: 8px 16px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;';
            btn.onclick = () => {
                chrome.runtime.openOptionsPage();
            };
            output.appendChild(btn);
        } else {
            document.getElementById('output').textContent = `❌ 語音識別錯誤: ${errorMsg}`;
        }
        
        isListening = false;
        updateMicSwitchUI();
    };
} else {
    console.warn("[Speech] 您的浏览器不支持 Web Speech API");
    document.getElementById('micSwitch').disabled = true;
    document.getElementById('micSwitch').title = '您的浏览器不支持语音识别';
}

// ======== 更新麥克風開關 UI ========
function updateMicSwitchUI() {
    const switchBtn = document.getElementById('micSwitch');
    const statusLabel = document.getElementById('micStatus');
    
    if (isMicEnabled) {
        switchBtn.classList.add('on');
        statusLabel.textContent = '開啟';
    } else {
        switchBtn.classList.remove('on');
        statusLabel.textContent = '關閉';
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
    
    if (isMicEnabled) {
        // 開啟常駐麥克風
        updateMicSwitchUI();
        document.getElementById('output').textContent = '🎤 語音已開啟';
        console.log("[Speech] 開始常駐監聽");
        recognition.start();
    } else {
        // 關閉常駐麥克風
        updateMicSwitchUI();
        document.getElementById('output').textContent = '🔇 語音已關閉';
        console.log("[Speech] 停止常駐監聽");
        recognition.stop();
    }
});

// ======== 頁面加載時自動啟動常駐麥克風 ========
document.addEventListener('DOMContentLoaded', () => {
    // 更新開關 UI 初始狀態
    updateMicSwitchUI();
    
    if (recognition && isMicEnabled) {
        console.log("[Speech] 頁面載入，自動啟動常駐麥克風");
        recognition.start();
    }
});

// ======== 執行按鈕事件 ========
document.getElementById('runBtn').addEventListener('click', async () => {
    const text = document.getElementById('userInput').value;
    const output = document.getElementById('output');
    
    if (!text) return;
    
    output.textContent = "處理中...";
    
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
        
        // 如果執行成功，清空輸入框
        if (res.status === "success") {
            console.log("[SidePanel] 執行成功，清空輸入框");
            document.getElementById('userInput').value = '';
            final_transcript = '';
            interim_transcript = '';
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
                sendResponse({ status: "success", result: result });
                
            } catch (error) {
                console.error(`[SidePanel] 技能執行失敗:`, error);
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
        // 1. 嘗試從剪貼板讀取文字
        let selectedText = "";
        try {
            selectedText = await navigator.clipboard.readText();
            console.log("[SidePanel] 從剪貼板讀取文字:", selectedText.substring(0, 50));
        } catch (err) {
            console.warn("[SidePanel] 無法讀取剪貼板:", err);
            selectedText = "";
        }
        
        // 2. 如果剪貼板為空，提示用戶
        if (!selectedText) {
            document.getElementById('output').textContent = "⚠️ 剪貼板為空。請先複製要查詢的文字。";
            return;
        }
        
        document.getElementById('output').textContent = `⏳ 正在開啟 Gemini，準備貼上：${selectedText.substring(0, 50)}...`;
        
        // 3. 直接在 SidePanel 中加載並執行 ask_gemini 技能（不經過 Service Worker）
        try {
            console.log("[SidePanel] 正在加載 ask_gemini 技能模組");
            const module = await import('./skills/askgemini/ask_gemini.js');
            
            const skillFunc = module.ask_gemini;
            if (typeof skillFunc !== 'function') {
                throw new Error('ask_gemini 技能函數未找到');
            }
            
            console.log("[SidePanel] 執行 ask_gemini 技能");
            const result = await skillFunc({ text: selectedText });
            
            console.log("[SidePanel] ask_gemini 執行成功:", result);
            document.getElementById('output').textContent = result;
            
        } catch (error) {
            console.error("[SidePanel] ask_gemini 執行失敗:", error);
            throw error;
        }
        
    } catch (error) {
        console.error("[SidePanel] Ask Gemini 失敗:", error);
        document.getElementById('output').textContent = `❌ Ask Gemini 失敗：${error.message}`;
    }
});