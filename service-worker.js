// service-worker.js - 核心网关 (Gateway-Client 模式)
// 唯一的邏輯中樞 - 所有操作在此執行

console.log("[Gateway] 🚀 Service Worker 已加載");

// ======== 技能註冊表和快取 ========
const SKILL_REGISTRY = {};

// 系統提示詞緩存
let dynamicSystemPrompt = "";
let loadingPromise = null;

// 技能對應表：{skillName: folderName}
// 此表將通過 loadSkillsDynamically() 動態填充
const SKILL_MAPPINGS = {};

// --- 執行 SidePanel 技能 ---
// 將技能執行請求轉發給 SidePanel，由 SidePanel 進行動態加載和執行
async function executeSidePanelSkill(skillName, skillFolder, args) {
    try {
        console.log(`[Gateway] 正在轉發技能到 SidePanel: ${skillName}`);
        
        // 發送消息給 SidePanel 執行技能
        return new Promise((resolve, reject) => {
            let responded = false;
            
            // 設置超時保護
            const timeoutId = setTimeout(() => {
                if (!responded) {
                    responded = true;
                    console.error(`[Gateway] SidePanel 技能執行超時 (5秒)`);
                    reject(new Error(`SidePanel 技能執行超時：無法連接或 SidePanel 未開啟`));
                }
            }, 5000);
            
            chrome.runtime.sendMessage(
                {
                    target: 'SIDE_PANEL',
                    type: 'EXECUTE_SKILL',
                    skill: skillName,
                    skillFolder: skillFolder,
                    args: args
                },
                (response) => {
                    if (responded) return;
                    responded = true;
                    clearTimeout(timeoutId);
                    
                    if (chrome.runtime.lastError) {
                        console.error(`[Gateway] SidePanel 通訊錯誤:`, chrome.runtime.lastError);
                        reject(new Error(`無法連接到 SidePanel: ${chrome.runtime.lastError.message}。請確保 SidePanel 已開啟。`));
                    } else if (response && response.status === 'success') {
                        console.log(`[Gateway] 技能執行成功:`, response.result);
                        resolve(response.result);
                    } else {
                        const error = response?.error || '未知錯誤';
                        console.error(`[Gateway] 技能執行失敗:`, error);
                        reject(new Error(error));
                    }
                }
            );
        });
    } catch (error) {
        console.error(`[Gateway] 執行技能失敗 [${skillName}]:`, error);
        throw error;
    }
}

// --- 階段 A：啟動與技能裝載（動態掃描） ---
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
        
        // 2. 動態構建技能映射表（不再預加載 Service Worker 技能，改為按需加載）
        for (const skill of manifestData.skills) {
            SKILL_MAPPINGS[skill.name] = {
                folder: skill.folder,
                runInPageContext: skill.runInPageContext !== false
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
            
            // 2. 構建 Key-Value Pair
            SKILL_REGISTRY[skillName] = {
                mdContent: mdContent,
                folder: skillConfig.folder,
                runInPageContext: skillConfig.runInPageContext
            };
            
            // 3. 構建 System Prompt
            promptBuilder += `=== 技能: ${skillName} ===\n${mdContent}\n\n`;
            console.log(`[Gateway] ✅ 技能 [${skillName}] 已加載 (在${skillConfig.runInPageContext ? '網頁前端' : 'Service Worker'}執行)`);
            
        } catch (e) {
            console.error(`[Gateway] ❌ 技能 [${skillName}] 載入失敗:`, e);
            console.error(`[Gateway] 詳細錯誤堆棧:`, e.stack);
        }
    }

    promptBuilder += "\n=== 重要規則 ===\n"
        + "1. 只回傳 JSON 格式，不要有任何其他文字\n"
        + "2. JSON 必須包含 skill 和對應的參數\n"
        + "3. 如果無法完成任務，回傳 {\"error\": \"原因\"}\n"
        + "4. 不要返回空的 JSON 對象 {}\n"
        + "5. 始終檢查用戶輸入是否匹配任何技能\n";
    dynamicSystemPrompt = promptBuilder;
    console.log("[Gateway] 技能庫已構建完成。已載入技能:", Object.keys(SKILL_REGISTRY));
}

chrome.runtime.onInstalled.addListener(loadSkillsDynamically);

// --- 訊息監聽 ---
console.log("[Gateway] 📡 註冊消息監聽器...");
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Gateway] ✉️  收到訊息:", request.action);
    console.log("[Gateway] 完整訊息內容:", JSON.stringify(request, null, 2));
    console.log("[Gateway] 訊息中的 config:", request.config ? '存在' : '❌ 不存在');
    
    try {
        if (request.action === "ask_ai") {
            console.log("[Gateway] 轉發給 handleRequest，config 類型:", typeof request.config);
            handleRequest(request.prompt, sendResponse, request.config);
            return true; 
        }
        
        // 處理來自網頁前端技能的 Chrome API 調用請求
        if (request.action === "execute_chrome_api") {
            handleChromeApiCall(request, sendResponse);
            return true;
        }
        
        // 語音識別消息由 Offscreen Document 處理，Service Worker 忽略
        if (request.action === "START_RECOGNITION" || request.action === "STOP_RECOGNITION") {
            console.log("[Gateway] 語音識別消息，轉發給 Offscreen Document");
            return true; // 不回應，由 offscreen 處理
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
async function handleRequest(userPrompt, sendResponse, configData = null) {
    try {
        console.log("[Gateway] ╔════════════════════════════════════════╗");
        console.log("[Gateway] ║  新請求開始處理                        ║");
        console.log("[Gateway] ╚════════════════════════════════════════╝");
        console.log("[Gateway] 用戶提示詞:", userPrompt);
        console.log("[Gateway] 配置對象是否存在:", !!configData);
        
        if (!configData) {
            console.error("[Gateway] ❌ configData 為 null/undefined");
            sendResponse({ status: "error", text: "❌ 未提供配置文件，無法執行 AI 功能" });
            return;
        }

        await ensureSkillsLoaded();
        
        console.log("[Gateway] ═══ 階段 B：呼叫 AI 模型 ═══");
        console.log("[Gateway] 接收到的 config:", JSON.stringify(configData, null, 2));
        console.log("[Gateway] activeModel 值:", configData.activeModel);
        console.log("[Gateway] activeModel 類型:", typeof configData.activeModel);
        console.log("[Gateway] 可用技能:", Object.keys(SKILL_REGISTRY));
        
        let aiResponse;
        if (configData.activeModel === 'ollamaGemma2B') {
            console.log("[Gateway] ✅ 選擇使用 Ollama Gemma 2B 模型 (小模型)");
            console.log("[Gateway] Ollama 配置:", JSON.stringify(configData.ollamaGemma2B, null, 2));
            aiResponse = await callOllama(userPrompt, dynamicSystemPrompt, configData.ollamaGemma2B);
        } else if (configData.activeModel === 'ollamaGemmaLarge') {
            console.log("[Gateway] ✅ 選擇使用 Ollama Gemma Large 模型 (大模型)");
            console.log("[Gateway] Ollama 配置:", JSON.stringify(configData.ollamaGemmaLarge, null, 2));
            aiResponse = await callOllama(userPrompt, dynamicSystemPrompt, configData.ollamaGemmaLarge);
        } else if (configData.activeModel === 'ollamaMinimaxM2') {
            console.log("[Gateway] ✅ 選擇使用 Ollama Minimax M2 模型");
            console.log("[Gateway] Ollama 配置:", JSON.stringify(configData.ollamaMinimaxM2, null, 2));
            aiResponse = await callOllama(userPrompt, dynamicSystemPrompt, configData.ollamaMinimaxM2);
        } else {
            console.log("[Gateway] ✅ 選擇使用 Gemini 2.5 Flash 模型");
            console.log("[Gateway] Gemini 配置:", JSON.stringify({...configData.geminiFlash, apiKey: '***'}));
            aiResponse = await callGeminiFlash(userPrompt, dynamicSystemPrompt, configData.geminiFlash);
        }
        
        console.log("[Gateway] AI 原始回應 (長度:", aiResponse.length, "):", aiResponse);
        console.log("[Gateway] AI 回應前 200 字:", aiResponse.substring(0, 200));
        console.log("[Gateway] AI 回應後 200 字:", aiResponse.substring(Math.max(0, aiResponse.length - 200)));
        
        // 解析 AI 回應
        let command;
        try {
            const cleanJson = aiResponse.replace(/```json|```/g, '').trim();
            console.log("[Gateway] 清理後的 JSON (長度:", cleanJson.length, "):", cleanJson);
            command = JSON.parse(cleanJson);
            console.log("[Gateway] ✅ 成功解析命令:", JSON.stringify(command));
        } catch (e) {
            console.error("[Gateway] ❌ JSON 解析失敗:", e.message);
            console.error("[Gateway] 原始回應:", aiResponse);
            console.error("[Gateway] 嘗試清理後的文本:", aiResponse.replace(/```json|```/g, '').trim());
            sendResponse({ status: "error", text: `AI 回應格式錯誤: ${aiResponse}` });
            return;
        }

        // 驗證和修復：檢查是否為空對象或缺少必要字段
        if (!command.skill || Object.keys(command).length === 0) {
            console.warn("[Gateway] ⚠️  檢測到空或無效的 AI 回應");
            console.warn("[Gateway] 原始 AI 回應內容:", aiResponse);
            console.warn("[Gateway] ❌ 找不到可以匹配的 skill");
            const availableSkills = Object.keys(SKILL_REGISTRY).length > 0 
                ? Object.keys(SKILL_REGISTRY).join('、') 
                : '目前沒有可用的技能';
            sendResponse({ status: "error", text: `找不到可以匹配的 skill。可用技能: ${availableSkills}` });
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
            console.error("[Gateway] ❌ 找不到可以匹配的 skill:", command.skill);
            console.error("[Gateway] 可用的技能:", Object.keys(SKILL_REGISTRY));
            const availableSkills = Object.keys(SKILL_REGISTRY).length > 0 
                ? Object.keys(SKILL_REGISTRY).join('、') 
                : '目前沒有可用的技能';
            sendResponse({ status: "error", text: `找不到可以匹配的 skill。用戶要求的 skill: ${command.skill}。可用技能: ${availableSkills}` });
            return;
        }

        console.log(`[Gateway] 執行技能: ${command.skill}`);
        console.log(`[Gateway] 傳遞給技能的完整命令:`, command);
        
        // 根據技能的執行環境選擇執行方式
        if (skillInfo.runInPageContext) {
            // 在網頁前端執行
            await runSkillInTabContext(command.skill, skillInfo, command.args, sendResponse);
        } else {
            // 在 Service Worker 中直接執行
            await runSkillInServiceWorker(command.skill, skillInfo, command.args, sendResponse);
        }
        
    } catch (error) {
        console.error("[Gateway] 執行失敗:", error);
        sendResponse({ status: "error", text: error.message });
    }
}

// --- 在 SidePanel 中執行技能 ---
async function runSkillInServiceWorker(skillName, skillInfo, args, sendResponse) {
    try {
        console.log(`[Gateway] 將技能轉發給 SidePanel 執行: ${skillName}`);
        console.log(`[Gateway] 傳遞的參數:`, args);
        
        // 替換佔位符：將 ACTIVE_TAB 和 ACTIVE_TAB_URL 替換為實際的 tabId 和 url
        if (args.tabId === "ACTIVE_TAB" || args.url === "ACTIVE_TAB_URL") {
            console.log(`[Gateway] 檢測到佔位符，正在獲取當前活動分頁...`);
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!activeTab) {
                throw new Error("無法獲取當前活動分頁");
            }
            
            if (args.tabId === "ACTIVE_TAB") {
                args.tabId = activeTab.id;
                console.log(`[Gateway] 替換 tabId: ${activeTab.id}`);
            }
            if (args.url === "ACTIVE_TAB_URL") {
                args.url = activeTab.url;
                console.log(`[Gateway] 替換 url: ${activeTab.url}`);
            }
        }
        
        // 改為調用 SidePanel 執行技能
        const result = await executeSidePanelSkill(skillName, skillInfo.folder, args);
        
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
async function callGeminiFlash(prompt, systemPrompt, geminiConfig) {
    try {
        console.log("[Gemini] 發送請求到 Gemini 2.5 Flash...");

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiConfig.apiKey}`;
        
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
                    temperature: geminiConfig.temperature || 0.3,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: geminiConfig.maxOutputTokens || 2048,
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

// --- Ollama API 調用 ---
async function callOllama(prompt, systemPrompt, ollamaConfig) {
    try {
        console.log(`[Ollama] 發送請求到 Ollama ${ollamaConfig.model}...`);

        const url = `${ollamaConfig.baseUrl}/api/generate`;
        
        // 强制 Ollama 返回 JSON 格式
        const forcedPrompt = `${systemPrompt}\n\n用戶指令: ${prompt}\n\n請立即回應以下 JSON 格式，不要有任何其他文字或解釋:\n{"skill": "...", ...}`;
        console.log("[Ollama] 發送的提示 (長度:", forcedPrompt.length, "字)");
        
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: ollamaConfig.model || "gemma2:2b",
                prompt: forcedPrompt,
                temperature: ollamaConfig.temperature || 0.1,  // 降低温度以获得更稳定的 JSON
                num_predict: ollamaConfig.numPredict || 500,    // 减少生成长度，避免超过 token 限制
                stream: false,
                system: "你是一個 JSON 格式生成器。只生成有效的 JSON，不要生成任何其他文字。"
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API 錯誤 ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.response) {
            console.log("[Ollama] ✅ 收到回應 (長度:", data.response.length, "字)");
            console.log("[Ollama] 原始回應:", data.response);
            console.log("[Ollama] 回應前 300 字:", data.response.substring(0, 300));
            return data.response;
        } else {
            console.error("[Ollama] ❌ 回應數據:", JSON.stringify(data));
            throw new Error("Ollama API 回應缺少預期的數據");
        }
    } catch (e) {
        console.error("[Ollama] 異常:", e);
        throw e;
    }
}