// service-worker.js - 核心网关 (Gateway-Client 模式 + 静态技能加载)

// 靜態導入技能模塊（必須在 Service Worker 中使用靜態 import）
import * as openTabSkill from './skills/opentab/open_tab.js';

// 技能註冊表 (Key-Value Pair)
// 格式: { skillName: { mdContent: "...", module: {...} } }
const SKILL_REGISTRY = {};

// 系統提示詞緩存
let dynamicSystemPrompt = "";
let loadingPromise = null;

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
    console.log("[Gateway] 啟動技能加載器...");
    
    // 技能映射：{skillName: {folderName, module}}
    // module 通過靜態 import 在頂部導入（Service Worker 不支持動態 import()）
    const skillMappings = {
        'open_tab': { 
            folderName: 'opentab',
            module: openTabSkill
        }
    };
    
    let promptBuilder = "你是一個 AI 代理人。你擁有以下技能，根據用戶需求回傳 JSON 格式的指令。\n\n";

    for (const [skillName, skillInfo] of Object.entries(skillMappings)) {
        try {
            // 1. 動態讀取 .md 文件
            const mdUrl = chrome.runtime.getURL(`skills/${skillInfo.folderName}/${skillName}.md`);
            console.log(`[Gateway] 讀取 MD: ${mdUrl}`);
            const mdResponse = await fetch(mdUrl);
            if (!mdResponse.ok) {
                throw new Error(`MD 文件加載失敗: ${mdResponse.status}`);
            }
            const mdContent = await mdResponse.text();
            
            // 2. 構建 Key-Value Pair（module 使用靜態導入）
            SKILL_REGISTRY[skillName] = {
                mdContent: mdContent,
                module: skillInfo.module
            };
            
            // 3. 構建 System Prompt
            promptBuilder += `=== 技能: ${skillName} ===\n${mdContent}\n\n`;
            console.log(`[Gateway] ✅ 技能 [${skillName}] 已載入`);
            
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

        // 執行技能
        console.log(`[Gateway] 執行技能: ${command.skill}`);
        const result = await skillInfo.module.run(command.args || {});
        
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