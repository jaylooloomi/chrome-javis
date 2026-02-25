// ======== Offscreen 文檔處理麥克風訪問 ========
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'zh-TW';
    
    recognition.onstart = () => {
        console.log("[Offscreen] 語音識別已啟動");
        chrome.runtime.sendMessage({ type: 'RECOGNITION_START' }).catch(() => {
            // sidepanel 可能尚未準備好，忽略
        });
    };
    
    recognition.onend = () => {
        console.log("[Offscreen] 語音識別已停止");
        chrome.runtime.sendMessage({ type: 'RECOGNITION_END' }).catch(() => {
            // sidepanel 可能尚未準備好，忽略
        });
    };
    
    recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        console.log("[Offscreen] 識別結果:", transcript);
        chrome.runtime.sendMessage({ 
            type: 'RECOGNITION_RESULT',
            transcript: transcript 
        }).catch(() => {
            // sidepanel 可能尚未準備好，忽略
        });
    };
    
    recognition.onerror = (event) => {
        console.error("[Offscreen] 錯誤:", event.error);
        chrome.runtime.sendMessage({ 
            type: 'RECOGNITION_ERROR',
            error: event.error 
        }).catch(() => {
            // sidepanel 可能尚未準備好，忽略
        });
    };
}

// 監聽來自 sidepanel 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.action) {
        console.warn("[Offscreen] 收到無效的消息:", message);
        return;
    }

    if (message.action === 'START_RECOGNITION') {
        console.log("[Offscreen] 收到開始識別請求");
        if (recognition) {
            // 先請求麥克風權限
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    console.log("[Offscreen] 麥克風權限已授予");
                    // 停止音頻流（我們只是為了請求權限）
                    stream.getTracks().forEach(track => track.stop());
                    // 開始語音識別
                    recognition.start();
                    sendResponse({ success: true });
                })
                .catch(error => {
                    console.error("[Offscreen] 麥克風權限被拒絕:", error);
                    sendResponse({ success: false, error: error.message });
                    // 發送錯誤消息給 sidepanel
                    chrome.runtime.sendMessage({ 
                        type: 'RECOGNITION_ERROR',
                        error: `麥克風權限被拒絕: ${error.message}` 
                    }).catch(() => {
                        // 忽略發送失敗
                    });
                });
            return true; // 保持連接以異步回應
        }
    } else if (message.action === 'STOP_RECOGNITION') {
        console.log("[Offscreen] 收到停止識別請求");
        if (recognition) {
            recognition.stop();
            sendResponse({ success: true });
        }
    }
});

