// switch_mode.js - 切換 AI 模型技能

console.log("[Switch Mode Skill] 已加載");

// 監聽來自 Service Worker 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Switch Mode Skill] 收到消息:", request.action);
    
    if (request.action === 'run_skill' && request.skillName === 'switch_mode') {
        console.log("[Switch Mode Skill] 執行切換模型指令");
        
        try {
            const args = request.args;
            const targetModel = args.model;
            
            console.log("[Switch Mode Skill] 目標模型:", targetModel);
            
            if (!targetModel) {
                sendResponse({ 
                    status: "error", 
                    error: "未指定目標模型" 
                });
                return;
            }
            
            // 驗證模型名稱
            const validModels = ['geminiFlash', 'ollamaGemma2B', 'ollamaGemmaLarge', 'ollamaMinimaxM2'];
            if (!validModels.includes(targetModel)) {
                sendResponse({ 
                    status: "error", 
                    error: `無效的模型: ${targetModel}。可用模型: ${validModels.join(', ')}` 
                });
                return;
            }
            
            // 使用 chrome.storage.local 保存新的 activeModel
            chrome.storage.local.get('voiceLanguage', (result) => {
                const voiceLanguage = result.voiceLanguage || 'zh-TW';
                
                // 重新構建完整的 config 對象
                const updatedConfig = {
                    activeModel: targetModel,
                    voiceLanguage: voiceLanguage,
                    geminiFlash: {
                        apiKey: "AIzaSyBsdyERXOGqoAgV_h6HaUw0auc85zdGJXE",
                        model: "gemini-2.5-flash",
                        temperature: 0.3,
                        maxOutputTokens: 2048
                    },
                    ollamaGemma2B: {
                        baseUrl: "http://localhost:11434",
                        model: "gemma2:2b",
                        temperature: 0.3,
                        numPredict: 2048
                    },
                    ollamaGemmaLarge: {
                        baseUrl: "http://localhost:11434",
                        model: "gemma:latest",
                        temperature: 0.3,
                        numPredict: 2048
                    },
                    ollamaMinimaxM2: {
                        baseUrl: "http://localhost:11434",
                        model: "minimax-m2:cloud",
                        temperature: 0.3,
                        numPredict: 2048
                    }
                };
                
                chrome.storage.local.set({ webConfig: updatedConfig }, () => {
                    console.log("[Switch Mode Skill] 模型已切換:", targetModel);
                    sendResponse({ 
                        status: "success", 
                        result: `✅ 已切換至模型: ${targetModel}` 
                    });
                });
            });
            
        } catch (error) {
            console.error("[Switch Mode Skill] 錯誤:", error);
            sendResponse({ 
                status: "error", 
                error: `執行失敗: ${error.message}` 
            });
        }
        
        return true; // 異步回應
    }
});
