// ======== 語音識別初始化 ========
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'zh-TW'; // 繁體中文
    
    recognition.onstart = () => {
        console.log("[Speech] 語音識別已啟動");
        isListening = true;
        document.getElementById('micBtn').classList.add('listening');
        document.getElementById('micBtn').textContent = '⏹️';
    };
    
    recognition.onend = () => {
        console.log("[Speech] 語音識別已停止");
        isListening = false;
        document.getElementById('micBtn').classList.remove('listening');
        document.getElementById('micBtn').textContent = '🎤';
    };
    
    recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        console.log("[Speech] 識別結果:", transcript);
        
        // 將識別結果附加到 textarea
        const userInput = document.getElementById('userInput');
        if (userInput.value) {
            userInput.value += ' ' + transcript;
        } else {
            userInput.value = transcript;
        }
    };
    
    recognition.onerror = (event) => {
        console.error("[Speech] 錯誤:", event.error);
        document.getElementById('output').textContent = `❌ 語音識別錯誤: ${event.error}`;
    };
} else {
    console.warn("[Speech] 您的瀏覽器不支持語音識別 API");
    document.getElementById('micBtn').disabled = true;
    document.getElementById('micBtn').title = '您的瀏覽器不支持語音識別';
}

// ======== 麥克風按鈕事件 ========
document.getElementById('micBtn').addEventListener('click', () => {
    if (!recognition) {
        alert('您的瀏覽器不支持語音識別');
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