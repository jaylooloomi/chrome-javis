// service-worker.js - 核心网关 (Gateway-Client 模式)

// 1. 【靜態匯入】所有技能模組
import * as openTabSkill from './skills/opentab/open_tab.js';
import * as summarizeSkill from './skills/summarize/summarize_page.js';

// 2. 技能註冊表
const SKILL_REGISTRY = {
    'open_tab': {
        module: openTabSkill,
        mdPath: 'skills/opentab/open_tab.md'
    },
    'summarize_page': {
        module: summarizeSkill,
        mdPath: 'skills/summarize/summarize_page.md'
    }
};

// 系統提示詞緩存
let dynamicSystemPrompt = "";
let loadingPromise = null;

// --- 階段 A：啟動與技能裝載 ---
async function ensureSkillsLoaded() {
    if (dynamicSystemPrompt) return;
    if (loadingPromise) {
        await loadingPromise;
        return;
    }
    loadingPromise = loadSkills();
    await loadingPromise;
    loadingPromise = null;
}

async function loadSkills() {
    console.log("[Gateway] 啟動技能加載器...");
    let promptBuilder = "你是一個 AI 代理人。你擁有以下技能，根據用戶需求回傳 JSON 格式的指令。\n\n";

    for (const [skillName, skillInfo] of Object.entries(SKILL_REGISTRY)) {
        try {
            const mdUrl = chrome.runtime.getURL(skillInfo.mdPath);
            const mdResponse = await fetch(mdUrl);
            const mdText = await mdResponse.text();
            
            skillInfo.config = mdText;
            promptBuilder += `=== 技能: ${skillName} ===\n${mdText}\n\n`;
            console.log(`[Gateway] ✅ 技能 [${skillName}] 已就緒`);
        } catch (e) {
            console.error(`[Gateway] ❌ 技能 [${skillName}] 載入失敗:`, e);
        }
    }

    promptBuilder += "\n重要規則：\n1. 必須回傳純 JSON 格式\n2. JSON 結構必須遵循技能規範\n3. 如果無法完成任務，回傳 {\"error\": \"原因\"}\n";
    dynamicSystemPrompt = promptBuilder;
    console.log("[Gateway] 技能庫已構建完成");
}

chrome.runtime.onInstalled.addListener(loadSkills);

// --- 訊息監聽 ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Gateway] 收到訊息:", request.action);
    
    try {
        if (request.action === "ask_ai") {
            handleRequest(request.prompt, sendResponse, request.geminiApiKey);
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

// --- 階段 B & C：接收指令、思考與調度 ---
async function handleRequest(userPrompt, sendResponse, geminiApiKey = null) {
    try {
        if (!geminiApiKey) {
            sendResponse({ status: "error", text: "❌ 未提供 Gemini API Key，無法執行 AI 功能" });
            return;
        }

        await ensureSkillsLoaded();
        
        console.log("[Gateway] 階段 B：呼叫 Gemini Flash...");
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

        // 查找技能
        const targetSkill = SKILL_REGISTRY[command.skill];
        if (!targetSkill) {
            sendResponse({ status: "error", text: `未知技能: ${command.skill}` });
            return;
        }

        // 執行技能
        console.log(`[Gateway] 執行技能: ${command.skill}`);
        const result = await targetSkill.module.run(command.args || {});
        
        // 特殊處理：summarize_page 需要進行 AI 總結
        if (command.skill === 'summarize_page' && result.pageContent) {
            console.log("[Gateway] 偵測到 summarize_page 內容，進行 AI 總結...");
            const summaryPrompt = "請用 Markdown 格式，分成「主要內容」、「關鍵重點」、「結論」三個部分，對以下文字進行總結";
            const summary = await callGeminiFlash(result.pageContent, summaryPrompt, geminiApiKey);
            sendResponse({ status: "success", text: summary });
            return;
        }
        
        sendResponse({ status: "success", text: result });
        
    } catch (error) {
        console.error("[Gateway] 執行失敗:", error);
        sendResponse({ status: "error", text: error.message });
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