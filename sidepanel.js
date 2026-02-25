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