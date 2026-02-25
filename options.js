// ======== 選項頁面 - 麥克風權限授予 ========
document.getElementById('requestMicBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = '';
    statusDiv.className = '';
    
    try {
        console.log("[Options] 正在請求麥克風權限...");
        statusDiv.textContent = '正在請求麥克風權限...';
        statusDiv.className = 'status pending';
        
        // 請求麥克風訪問
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        console.log("[Options] 麥克風權限已授予");
        statusDiv.textContent = '✅ 麥克風權限已成功授予！您現在可以在 Side Panel 中使用語音輸入功能。';
        statusDiv.className = 'status success';
        
        // 停止音頻流
        stream.getTracks().forEach(track => track.stop());
        
    } catch (error) {
        console.error("[Options] 麥克風權限被拒絕:", error);
        
        let errorMsg = error.name;
        if (error.name === 'NotAllowedError') {
            errorMsg = '您拒絕了麥克風訪問權限';
        } else if (error.name === 'NotFoundError') {
            errorMsg = '未找到麥克風設備';
        } else if (error.name === 'NotReadableError') {
            errorMsg = '麥克風被其他應用程式佔用';
        }
        
        statusDiv.textContent = `❌ 麥克風權限授予失敗: ${errorMsg}`;
        statusDiv.className = 'status error';
    }
});
