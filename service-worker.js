// service-worker.js - 核心网关 (Gateway-Client 模式)
// 方案 B：使用 chrome.scripting.executeScript 在網頁前端執行技能

// 技能註冊表 (Key-Value Pair，僅存儲 .md 說明)
// 格式: { skillName: { mdContent: "..." } }
const SKILL_REGISTRY = {};

// 系統提示詞緩存
let dynamicSystemPrompt = "";
let loadingPromise = null;

// 技能對應表：{skillName: folderName}
// 此表將通過 loadSkillsDynamically() 動態填充
const SKILL_MAPPINGS = {};

// --- 階段 A：啟動與技能裝載（僅讀取 .md 文件） ---
async function ensureSkillsLoaded() {
    if (dynamicSystemPrompt) return;
    if (loadingPromise) {
        await loadingPromise;
        return;
    }
    loadingPromise = loadSkillsDynamically();
    await loadingPromise;
    loadingPromise = null;
}

async function loadSkillsDynamically() {
    console.log("[Gateway] 啟動動態技能加載器...");
    
    try {
        // 1. 從 skills-manifest.json 讀取技能列表
        const manifestUrl = chrome.runtime.getURL('skills-manifest.json');
        console.log(`[Gateway] 讀取技能清單: ${manifestUrl}`);
        const manifestResponse = await fetch(manifestUrl);
        if (!manifestResponse.ok) {
            throw new Error(`技能清單加載失敗: ${manifestResponse.status}`);
        }
        const manifestData = await manifestResponse.json();
        
        // 2. 動態構建技能映射表
        for (const skill of manifestData.skills) {
            SKILL_MAPPINGS[skill.name] = {
                folder: skill.folder,
                runInPageContext: skill.runInPageContext !== false  // 預設為 true
            };
        }
        
        console.log(`[Gateway] 發現技能: ${Object.keys(SKILL_MAPPINGS).join(', ')}`);
    } catch (e) {
        console.error(`[Gateway] ❌ 技能清單讀取失敗:`, e);
        console.error(`[Gateway] 詳細錯誤堆棧:`, e.stack);
        return;
    }
    
    let promptBuilder = "你是一個 AI 代理人。你擁有以下技能，根據用戶需求回傳 JSON 格式的指令。\n\n";

    for (const [skillName, skillConfig] of Object.entries(SKILL_MAPPINGS)) {
        try {
            // 1. 動態讀取 .md 文件（獲取技能說明）
            const mdUrl = chrome.runtime.getURL(`skills/${skillConfig.folder}/${skillName}.md`);
            console.log(`[Gateway] 讀取 MD: ${mdUrl}`);
            const mdResponse = await fetch(mdUrl);
            if (!mdResponse.ok) {
                throw new Error(`MD 文件加載失敗: ${mdResponse.status}`);
            }
            const mdContent = await mdResponse.text();
            
            // 2. 如果是 Service Worker 執行的技能，動態導入 .js 文件
            let skillModule = null;
            if (!skillConfig.runInPageContext) {
                console.log(`[Gateway] 動態導入 Service Worker 技能: skills/${skillConfig.folder}/${skillName}_service.js`);
                try {
                    skillModule = await import(`./skills/${skillConfig.folder}/${skillName}_service.js`);
                } catch (importError) {
                    console.warn(`[Gateway] ⚠️ 無法導入 ${skillName}_service.js:`, importError);
                }
            }
            
            // 3. 構建 Key-Value Pair
            SKILL_REGISTRY[skillName] = {
                mdContent: mdContent,
                folder: skillConfig.folder,
                runInPageContext: skillConfig.runInPageContext,
                module: skillModule
            };
            
            // 4. 構建 System Prompt
            promptBuilder += `=== 技能: ${skillName} ===\n${mdContent}\n\n`;
            console.log(`[Gateway] ✅ 技能 [${skillName}] 已載入 (在${skillConfig.runInPageContext ? '網頁前端' : 'Service Worker'}執行)`);
            
        } catch (e) {
            console.error(`[Gateway] ❌ 技能 [${skillName}] 載入失敗:`, e);
            console.error(`[Gateway] 詳細錯誤堆棧:`, e.stack);
        }
    }

    promptBuilder += "\n重要規則：\n1. 必須回傳純 JSON 格式\n2. JSON 結構必須遵循技能規範\n3. 如果無法完成任務，回傳 {\"error\": \"原因\"}\n";
    dynamicSystemPrompt = promptBuilder;
    console.log("[Gateway] 技能庫已構建完成。已載入技能:", Object.keys(SKILL_REGISTRY));
}

chrome.runtime.onInstalled.addListener(loadSkillsDynamically);

// --- 訊息監聽 ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Gateway] 收到訊息:", request.action);
    
    try {
        if (request.action === "ask_ai") {
            handleRequest(request.prompt, sendResponse, request.geminiApiKey);
            return true; 
        }
        
        // 處理來自網頁前端技能的 Chrome API 調用請求
        if (request.action === "execute_chrome_api") {
            handleChromeApiCall(request, sendResponse);
            return true;
        }
        
        console.warn("[Gateway] 未知的訊息類型:", request.action);
        sendResponse({ status: "error", text: "未知訊息類型" });
        return true;
    } catch (error) {
        console.error("[Gateway] 訊息處理錯誤:", error);
        sendResponse({ status: "error", text: error.message });
        return true;
    }
});

// 處理來自網頁前端技能的 Chrome API 調用
async function handleChromeApiCall(request, sendResponse) {
    try {
        console.log(`[Gateway] 執行 Chrome API: ${request.apiCall}`);
        
        if (request.apiCall === "tabs.create") {
            const tab = await chrome.tabs.create(request.params);
            console.log(`[Gateway] tabs.create 成功，ID: ${tab.id}`);
            sendResponse({ status: "success", result: tab });
        } else {
            throw new Error(`未支持的 API: ${request.apiCall}`);
        }
    } catch (error) {
        console.error(`[Gateway] API 調用失敗:`, error);
        sendResponse({ status: "error", error: error.message });
    }
}

// --- 階段 B & C：接收指令、思考與調度 ---
async function handleRequest(userPrompt, sendResponse, geminiApiKey = null) {
    try {
        if (!geminiApiKey) {
            sendResponse({ status: "error", text: "❌ 未提供 Gemini API Key，無法執行 AI 功能" });
            return;
        }

        await ensureSkillsLoaded();
        
        console.log("[Gateway] 階段 B：呼叫 Gemini Flash...");
        console.log("[Gateway] 可用技能:", Object.keys(SKILL_REGISTRY));
        
        const aiResponse = await callGeminiFlash(userPrompt, dynamicSystemPrompt, geminiApiKey);
        
        console.log("[Gateway] AI 回應:", aiResponse);
        
        // 解析 AI 回應
        let command;
        try {
            const cleanJson = aiResponse.replace(/```json|```/g, '').trim();
            command = JSON.parse(cleanJson);
        } catch (e) {
            console.error("[Gateway] JSON 解析失敗:", e);
            sendResponse({ status: "error", text: `AI 回應格式錯誤: ${aiResponse}` });
            return;
        }

        console.log("[Gateway] 階段 C：調度技能...");
        
        // 檢查是否為錯誤回應
        if (command.error) {
            sendResponse({ status: "error", text: `AI 決策: ${command.error}` });
            return;
        }

        // 查找技能（從 Key-Value Pair 中查詢）
        const skillInfo = SKILL_REGISTRY[command.skill];
        if (!skillInfo) {
            sendResponse({ status: "error", text: `未知技能: ${command.skill}。可用技能: ${Object.keys(SKILL_REGISTRY).join(', ')}` });
            return;
        }

        console.log(`[Gateway] 執行技能: ${command.skill}`);
        
        // 根據技能的執行環境選擇執行方式
        if (skillInfo.runInPageContext) {
            // 在網頁前端執行
            await runSkillInTabContext(command.skill, skillInfo, command.args || {}, sendResponse);
        } else {
            // 在 Service Worker 中執行
            await runSkillInServiceWorker(command.skill, skillInfo, command.args || {}, sendResponse);
        }
        
    } catch (error) {
        console.error("[Gateway] 執行失敗:", error);
        sendResponse({ status: "error", text: error.message });
    }
}

// --- 在 Service Worker 中執行技能 ---
async function runSkillInServiceWorker(skillName, skillInfo, args, sendResponse) {
    try {
        if (!skillInfo.module) {
            throw new Error(`技能 ${skillName} 的模塊未加載`);
        }
        
        console.log(`[Gateway] 在 Service Worker 中執行技能: ${skillName}`);
        
        // 呼叫技能的執行函數
        const functionName = `run${skillName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')}Skill`;
        if (typeof skillInfo.module[functionName] !== 'function') {
            throw new Error(`技能模塊未匯出 ${functionName} 函數`);
        }
        
        const result = await skillInfo.module[functionName](args);
        console.log(`[Gateway] 技能 ${skillName} 執行結果:`, result);
        
        sendResponse({ status: "success", text: result });
        
    } catch (error) {
        console.error(`[Gateway] 技能執行失敗:`, error);
        sendResponse({ status: "error", text: `技能執行失敗: ${error.message}` });
    }
}

// --- 在網頁前端執行技能 ---
async function runSkillInTabContext(skillName, skillInfo, args, sendResponse) {
    try {
        // 1. 取得當前活動分頁
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            throw new Error("無法找到活動分頁");
        }

        // 2. 檢查是否是 chrome:// 系統頁面，如果是則創建一個新分頁
        if (tab.url.startsWith('chrome://')) {
            console.log(`[Gateway] 當前分頁是 ${tab.url}，無法注入腳本，創建新分頁...`);
            const newTab = await chrome.tabs.create({ url: "about:blank" });
            tab = newTab;
        }

        console.log(`[Gateway] 在分頁 ID ${tab.id} 注入技能: ${skillName}`);

        // 3. 注入技能腳本到網頁前端
        const skillFilePath = `skills/${skillInfo.folder}/${skillName}.js`;
        console.log(`[Gateway] 注入文件: ${skillFilePath}`);
        
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: [skillFilePath]
        });

        console.log(`[Gateway] 技能腳本已注入`);

        // 4. 在網頁前端調用技能
        const callResult = await chrome.tabs.sendMessage(tab.id, {
            action: "run_skill",
            skillName: skillName,
            args: args
        });

        console.log(`[Gateway] 技能執行結果:`, callResult);
        
        if (callResult.status === "success") {
            sendResponse({ status: "success", text: callResult.result });
        } else {
            sendResponse({ status: "error", text: callResult.error });
        }

    } catch (error) {
        console.error(`[Gateway] 技能執行失敗:`, error);
        sendResponse({ status: "error", text: `技能執行失敗: ${error.message}` });
    }
}

// --- Gemini Flash API 呼叫 ---
async function callGeminiFlash(prompt, systemPrompt, geminiApiKey) {
    try {
        console.log("[Gemini] 發送請求到 Gemini 2.5 Flash...");

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
        
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${systemPrompt}\n\n用戶指令: ${prompt}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                }
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API 錯誤 ${response.status}: ${errorData.error?.message || '未知錯誤'}`);
        }
        
        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const result = data.candidates[0].content.parts[0].text;
            console.log("[Gemini] ✅ 成功");
            return result;
        } else {
            throw new Error("Gemini API 回應缺少預期的數據");
        }
    } catch (e) {
        console.error("[Gemini] 異常:", e);
        throw e;
    }
}