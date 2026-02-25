document.getElementById('runBtn').addEventListener('click', async () => {
    const text = document.getElementById('userInput').value;
    const geminiApiKey = document.getElementById('geminiApiKey').value;
    const output = document.getElementById('output');
    if (!text) return;
    
    output.textContent = "處理中...";
    const res = await chrome.runtime.sendMessage({ 
        action: "ask_ai", 
        prompt: text,
        geminiApiKey: geminiApiKey || null 
    });
    output.textContent = res.text || res.error;
});