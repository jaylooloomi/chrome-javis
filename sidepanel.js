// ======== 語音識別初始化 (直接使用 Web Speech API) ========
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
let final_transcript = '';
let interim_transcript = '';

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
        document.getElementById('micBtn').textContent = '🎤';
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
        document.getElementById('micBtn').classList.remove('listening');
        document.getElementById('micBtn').textContent = '🎤';
    };
} else {
    console.warn("[Speech] 您的浏览器不支持 Web Speech API");
    document.getElementById('micBtn').disabled = true;
    document.getElementById('micBtn').title = '您的浏览器不支持语音识别';
}

// ======== 麥克風按鈕事件 ========
document.getElementById('micBtn').addEventListener('click', () => {
    if (!recognition) {
        alert('您的浏览器不支持语音识别');
        return;
    }

    if (isListening) {
        // 停止識別
        recognition.stop();
    } else {
        // 開始識別
        document.getElementById('userInput').focus();
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
        // 從 config.json 讀取 API Key
        const configResponse = await fetch(chrome.runtime.getURL('config.json'));
        const config = await configResponse.json();
        const geminiApiKey = config.geminiApiKey;
        
        const res = await chrome.runtime.sendMessage({ 
            action: "ask_ai", 
            prompt: text,
            geminiApiKey: geminiApiKey || null 
        });
        output.textContent = res.text || res.error;
    } catch (error) {
        output.textContent = `❌ 錯誤: ${error.message}`;
    }
});