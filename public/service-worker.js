// service-worker.js - 核心网关 (Gateway-Client 模式)
// 唯一的邏輯中樞 - 所有操作在此執行

// ======== 導入通知工具 ========
// 注：service-worker 中不能直接 import，需要通過消息傳遞調用 SidePanel 中的通知
// 我們將通過 chrome.runtime.sendMessage 間接調用通知功能

console.log("[Gateway] 🚀 Service Worker 已加載");

// ======== 點擊 Extension Icon 時打開 SidePanel ========
chrome.action.onClicked.addListener(async (tab) => {
    try {
        console.log(`[Gateway] 點擊 Extension Icon，打開 SidePanel for tab ${tab.id}`);
        await chrome.sidePanel.open({ tabId: tab.id });
    } catch (error) {
        console.error(`[Gateway] 打開 SidePanel 失敗:`, error);
    }
});

// ======== 緩存初始化標誌 ========
// 確保 get_cache_stats 時初始化已完成
let cacheInitialized = false;

// ======== 模型名稱映射表 ========
// 從 config.json 動態加載，避免硬編碼
let MODEL_NAMES = {};

// ======== 技能註冊表和快取 ========
const SKILL_REGISTRY = {};

// 系統提示詞緩存
let dynamicSystemPrompt = "";
let loadingPromise = null;

// 技能對應表：{skillName: folderName}
// 此表將通過 loadSkillsDynamically() 動態填充
const SKILL_MAPPINGS = {};

// ======== AI 推理結果快取 (階段1：內存快取 + 精確匹配) ========
// 用於存儲 userInput → AI 推理結果的映射
// 相同的用戶輸入可直接返回快取結果，無需再次呼叫 AI 模型
const aiResultCache = new Map();

// ======== 最近使用的快取列表 (LRU - 策略 A：寫入時更新順序) ========
// 結構: [{userInput, skill, args, timestamp}, ...]
// 只保留最近 10 條記錄，便於監控和調試
// 用途：查看歷史快取，未來可用於 UI 展示
const recentCacheList = [];
const MAX_RECENT_CACHE = 50;
const MAX_CACHE_SIZE = 50;  // ← Phase 2 淘汰機制預留
const CACHE_TTL_DAYS = 30;  // Phase 3 數據過期機制
const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;  // 毫秒

// ======== Local 存儲持久化（永久化快取 + Service Worker 重啟保護） ========

/**
 * 判斷快取項目是否已過期
 * @param {object} cacheItem - 快取項目
 * @returns {boolean} - 是否過期
 */
function isExpired(cacheItem) {
    // 舊快取沒有 expiresAt，視為有效（用戶會清空舊資料，此分支不會執行）
    if (!cacheItem.expiresAt) {
        return false;
    }
    
    const now = Date.now();
    return now > cacheItem.expiresAt;
}

/**
 * 清理所有過期的快取項目
 * 從 recentCacheList 和 aiResultCache 中同時移除
 */
function cleanupExpiredCache() {
    const beforeSize = aiResultCache.size;
    
    // 遍歷 recentCacheList，移除已過期的快取
    recentCacheList = recentCacheList.filter(item => {
        if (isExpired(item)) {
            aiResultCache.delete(item.userInput);
            console.log(`[Gateway] 🗑️ 清理過期快取: "${item.userInput}"`);
            return false;  // 從列表中移除
        }
        return true;  // 保留
    });
    
    const afterSize = aiResultCache.size;
    console.log(`[Gateway] ✅ 過期快取清理完成: ${beforeSize} → ${afterSize}`);
}

/**
 * 在 Service Worker 啟動時從 local 存儲恢復快取
 * 改用 local 替代 session，實現永久化存儲
 * 同時恢復 aiResultCache 和 recentCacheList
 */
async function initializeCacheFromLocal() {
    try {
        const stored = await chrome.storage.local.get('aiCache');
        if (!stored.aiCache) {
            console.log(`[Gateway] 📦 local 中無快取數據`);
            return 0;
        }
        
        // 新格式：{cache: [...], recent: [...]}
        if (stored.aiCache.cache && Array.isArray(stored.aiCache.cache)) {
            // 恢復 aiResultCache
            stored.aiCache.cache.forEach(([key, value]) => {
                aiResultCache.set(key, value);
            });
            console.log(`[Gateway] ✅ 恢復 aiResultCache: ${stored.aiCache.cache.length} 項`);
            
            // 恢復 recentCacheList
            if (stored.aiCache.recent && Array.isArray(stored.aiCache.recent)) {
                recentCacheList.splice(0, 0, ...stored.aiCache.recent);
                console.log(`[Gateway] ✅ 恢復 recentCacheList: ${stored.aiCache.recent.length} 項`);
            }
            
            // 🆕 Phase 3：添加遷移邏輯
            // 舊快取沒有 expiresAt，補上 30 天期限
            recentCacheList = recentCacheList.map(item => ({
                ...item,
                expiresAt: item.expiresAt || (Date.now() + CACHE_TTL_MS)
            }));
            
            // 🆕 Phase 3：清理過期快取
            cleanupExpiredCache();
            
            return aiResultCache.size;
        }
        // 舊格式：直接是數組（向后兼容）
        else if (Array.isArray(stored.aiCache)) {
            stored.aiCache.forEach(([key, value]) => {
                aiResultCache.set(key, value);
            });
            console.log(`[Gateway] ⚠️ 檢測到舊格式快取，已恢復 ${stored.aiCache.length} 項`);
            return stored.aiCache.length;
        }
        
        return 0;
    } catch (error) {
        console.warn(`[Gateway] ⚠️ 從 local 恢復快取失敗:`, error);
        return 0;
    }
}

/**
 * 異步將快取保存到 local 存儲（不阻塞主線程）
 * 同時保存 aiResultCache 和 recentCacheList
 */
async function saveCacheToLocal() {
    try {
        const cacheData = {
            cache: Array.from(aiResultCache.entries()),
            recent: recentCacheList
        };
        await chrome.storage.local.set({ aiCache: cacheData });
        console.log(`[Gateway] 💾 快取已保存到 local (${cacheData.cache.length} 項快取, ${cacheData.recent.length} 條記錄)`);
    } catch (error) {
        console.warn(`[Gateway] ⚠️ 快取保存到 local 失敗，但內存快取仍有效:`, error);
    }
}

/**
 * 強制快取大小限制（超過 MAX_CACHE_SIZE 時刪除最老的）
 * 使用 FIFO 策略：刪除 recentCacheList 中最老的記錄
 */
function enforceCacheSizeLimit() {
    if (aiResultCache.size <= MAX_CACHE_SIZE) {
        return;  // 未超限，無需淘汰
    }
    
    console.log(`[Gateway] ⚠️ 快取已超限 (${aiResultCache.size} > ${MAX_CACHE_SIZE})`);
    
    // 刪除 recentCacheList 中最老的記錄，直到達到限制
    while (aiResultCache.size > MAX_CACHE_SIZE && recentCacheList.length > 0) {
        const oldest = recentCacheList.pop();  // 刪除最老的
        aiResultCache.delete(oldest.userInput);
        console.log(`[Gateway] 🗑️ 淘汰快取: "${oldest.userInput}"`);
    }
    
    console.log(`[Gateway] ✅ 淘汰完成，快取大小: ${aiResultCache.size}`);
}

/**
 * 獲取當前存儲使用情況
 * @returns {Promise<object>} - {used: bytes, usedMB, percentage: 0-100, status: 'ok'|'warning'|'critical'}
 */
async function getStorageUsage() {
    try {
        // 估算存儲使用（JSON 序列化後的大小）
        const cacheData = {
            cache: Array.from(aiResultCache.entries()),
            recent: recentCacheList
        };
        const jsonString = JSON.stringify(cacheData);
        const usedBytes = new Blob([jsonString]).size;
        
        // Chrome local storage 限制 10MB
        const maxBytes = 10 * 1024 * 1024;  // 10MB
        const percentage = Math.round((usedBytes / maxBytes) * 100);
        
        let status = 'ok';
        if (percentage >= 90) status = 'critical';
        else if (percentage >= 70) status = 'warning';
        
        return {
            used: usedBytes,
            usedMB: (usedBytes / 1024 / 1024).toFixed(2),
            max: maxBytes,
            maxMB: 10,
            percentage: percentage,
            status: status  // 'ok' | 'warning' | 'critical'
        };
    } catch (error) {
        console.warn(`[Gateway] ⚠️ 無法計算存儲使用:`, error);
        return {
            used: 0,
            usedMB: '0.00',
            max: 10 * 1024 * 1024,
            maxMB: 10,
            percentage: 0,
            status: 'ok'
        };
    }
}

/**
 * 從快取中獲取 AI 推理結果
 * @param {string} userInput - 用戶的文本輸入
 * @returns {object|null} - 快取的結果或 null（如果未找到）
 */
function getFromCache(userInput) {
    const cacheItem = recentCacheList.find(item => item.userInput === userInput);
    
    if (!cacheItem) {
        return null;
    }
    
    // 🆕 Phase 3：檢查是否過期
    if (isExpired(cacheItem)) {
        console.log(`[Gateway] ⏰ 快取已過期: "${userInput}"`);
        aiResultCache.delete(userInput);
        recentCacheList = recentCacheList.filter(item => item.userInput !== userInput);
        return null;
    }
    
    // 快取有效
    const result = aiResultCache.get(userInput);
    if (result) {
        console.log(`[Gateway] 🚀 快取命中: "${userInput}"`);
        console.log(`[Gateway] 快取結果:`, result);
    }
    return result;
}

/**
 * 將 AI 推理結果存入快取
 * @param {string} userInput - 用戶的文本輸入
 * @param {object} result - AI 推理結果 {skill, args}
 */
function putInCache(userInput, result) {
    // 1. 存入主快取 Map
    aiResultCache.set(userInput, result);
    
    // 2. 從 recentCacheList 中移除舊的同 key 項目（避免重複）
    const index = recentCacheList.findIndex(item => item.userInput === userInput);
    if (index !== -1) {
        recentCacheList.splice(index, 1);
    }
    
    // 3. 更新最近使用列表（策略 A：寫入時更新）
    // 🆕 Phase 3：添加 expiresAt 字段
    const now = Date.now();
    const expiresAt = now + CACHE_TTL_MS;
    
    recentCacheList.unshift({
        userInput,
        skill: result.skill,
        args: result.args,
        timestamp: now,
        expiresAt: expiresAt  // 🆕 新增過期時間
    });
    
    // 4. 限制列表大小（只保留最近 10 條）
    if (recentCacheList.length > MAX_RECENT_CACHE) {
        recentCacheList.pop();
    }
    
    // 5. ✨ 強制快取大小限制（超過 MAX_CACHE_SIZE 時淘汰）
    enforceCacheSizeLimit();
    
    // 6. ✨ 異步保存到 local（不阻塞）
    saveCacheToLocal().catch(err => 
        console.warn(`[Gateway] 快取 local 保存失敗（非致命）:`, err)
    );
    
    console.log(`[Gateway] 📝 將結果快取: "${userInput}"`);
    console.log(`[Gateway] 目前快取大小: ${aiResultCache.size} 個項目`);
    console.log(`[Gateway] 最近使用快取: ${recentCacheList.length} 條`);
}

/**
 * 獲取最近使用的 N 條快取記錄
 * @param {number} n - 要獲取的記錄數，默認 2
 * @returns {array} - 最近 N 條快取 [{userInput, skill, args, timestamp}, ...]
 */
function getLatestCacheEntries(n = 2) {
    return recentCacheList.slice(0, n);
}

/**
 * 獲取快取統計信息（用於監控面板和調試）
 * @returns {Promise<object>} - {totalCacheSize, recentCount, recentEntries, storage, etc.}
 */
async function getCacheStats() {
    // 🆕 Phase 3：計算過期快取數量
    const expiredCount = recentCacheList.filter(item => isExpired(item)).length;
    const validCount = aiResultCache.size - expiredCount;
    
    // 改用緩存數量百分比而不是字節大小
    const percentage = Math.round((aiResultCache.size / MAX_CACHE_SIZE) * 100);
    let status = 'ok';
    if (percentage >= 90) status = 'critical';
    else if (percentage >= 70) status = 'warning';
    
    const storage = {
        used: aiResultCache.size,
        usedMB: aiResultCache.size.toString(),  // 顯示項目數
        max: MAX_CACHE_SIZE,
        maxMB: MAX_CACHE_SIZE.toString(),  // 最大容量
        percentage: percentage,
        status: status  // 'ok' | 'warning' | 'critical'
    };
    
    return {
        totalCacheSize: aiResultCache.size,
        maxCacheSize: MAX_CACHE_SIZE,
        recentCount: recentCacheList.length,
        maxRecent: MAX_RECENT_CACHE,
        recentEntries: recentCacheList,  // 返回全部最近記錄
        oldestEntry: recentCacheList[recentCacheList.length - 1] || null,
        storage: storage,  // 新增存儲信息
        expiredCount: expiredCount,  // 🆕 過期快取數
        validCount: validCount       // 🆕 有效快取數
    };
}

// --- 執行 SidePanel 技能 ---
// 將技能執行請求轉發給 SidePanel，由 SidePanel 進行動態加載和執行
async function executeSidePanelSkill(skillName, skillFolder, args, runInPageContext) {
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
                    runInPageContext: runInPageContext,  // ← 執行環境標誌
                    args: args                           // ← tabId 已包含在 args 中
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
    if (dynamicSystemPrompt && Object.keys(MODEL_NAMES).length > 0) return;
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
    
    // 加載模型名稱映射表
    try {
        const configUrl = chrome.runtime.getURL('config.json');
        const configResponse = await fetch(configUrl);
        const configData = await configResponse.json();
        MODEL_NAMES = configData.modelNames || {};
        console.log("[Gateway] ✅ 已加載模型名稱映射表:", MODEL_NAMES);
    } catch (e) {
        console.warn("[Gateway] ⚠️  無法加載模型名稱，使用默認值");
        MODEL_NAMES = {
            'geminiFlash': 'Gemini 2.5 Flash',
            'ollamaGemma2B': 'Ollama Gemma 2B',
            'ollamaGemmaLarge': 'Ollama Gemma Large',
            'ollamaMinimaxM2': 'Ollama Minimax M2'
        };
    }
    
    try {
        // 1. 從 skills/skills-manifest.json 讀取技能列表
        const manifestUrl = chrome.runtime.getURL('skills/skills-manifest.json');
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

// ======== Service Worker 啟動時立即初始化緩存 ========
// 從 local 恢復永久化緩存
(async () => {
    console.log("[Gateway] 正在初始化緩存...");
    await loadSkillsDynamically();
    await initializeCacheFromLocal();
    cacheInitialized = true;
    console.log("[Gateway] ✅ 緩存初始化完成");
})();

chrome.runtime.onInstalled.addListener(loadSkillsDynamically);

// --- 訊息監聽 ---
console.log("[Gateway] 📡 註冊消息監聽器...");
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Gateway] ✉️  收到訊息:", request.action);
    console.log("[Gateway] 完整訊息內容:", JSON.stringify(request, null, 2));
    console.log("[Gateway] 訊息中的 config:", request.config ? '存在' : '❌ 不存在');
    console.log("[Gateway] sender.tab:", sender.tab ? `ID: ${sender.tab.id}, URL: ${sender.tab.url}` : '❌ 不存在');
    
    try {
        if (request.action === "ask_ai") {
            console.log("[Gateway] 轉發給 handleRequest，config 類型:", typeof request.config);
            handleRequest(request.prompt, sendResponse, request.config, sender.tab);
            return true; 
        }
        
        // 處理來自網頁前端技能的 Chrome API 調用請求
        if (request.action === "execute_chrome_api") {
            handleChromeApiCall(request, sendResponse);
            return true;
        }
        
        // ====== 快取查詢 API ======
        if (request.action === "get_cache_stats") {
            console.log("[Gateway] 快取查詢: 獲取統計數據");
            
            // 等待初始化完成（最多等 3 秒）
            (async () => {
                let waitCount = 0;
                while (!cacheInitialized && waitCount < 60) {
                    await new Promise(r => setTimeout(r, 50));
                    waitCount++;
                }
                
                if (!cacheInitialized) {
                    console.warn("[Gateway] ⚠️ 初始化超時，但仍返回當前緩存");
                }
                
                const stats = await getCacheStats();
                console.log("[Gateway] 快取統計:", stats);
                sendResponse({ status: "success", data: stats });
            })();
            return true;
        }
        
        // ====== 快取清空 API ======
        if (request.action === "clear_cache") {
            console.log("[Gateway] 執行快取清空操作");
            aiResultCache.clear();
            recentCacheList.length = 0;
            
            // ✨ 同時清空 local 中的快取
            chrome.storage.local.remove('aiCache').catch(err => {
                console.warn("[Gateway] ⚠️ 清空 local 快取失敗（非致命）:", err);
            });
            
            console.log("[Gateway] ✅ 快取已清空（內存 + Local）");
            sendResponse({ status: "success", message: "快取已清空" });
            return true;
        }
        
        // ====== 刪除指定快取項目 API ======
        if (request.action === "delete_cache_item") {
            const userInput = request.userInput;
            console.log(`[Gateway] 請求刪除指定快取: "${userInput}"`);
            
            // 1. 從 aiResultCache 刪除
            if (aiResultCache.has(userInput)) {
                aiResultCache.delete(userInput);
                console.log(`[Gateway] ✅ 已從 aiResultCache 刪除: "${userInput}"`);
            }
            
            // 2. 從 recentCacheList 刪除（使用 splice，不能直接重新賦值 const）
            const beforeCount = recentCacheList.length;
            const index = recentCacheList.findIndex(item => item.userInput === userInput);
            if (index !== -1) {
                recentCacheList.splice(index, 1);
            }
            const afterCount = recentCacheList.length;
            
            if (beforeCount > afterCount) {
                console.log(`[Gateway] ✅ 已從 recentCacheList 刪除: "${userInput}"`);
            }
            
            // 3. 同步保存到 local 存儲
            saveCacheToLocal().catch(err => {
                console.warn("[Gateway] ⚠️ 同步 local 存儲失敗（非致命）:", err);
            });
            
            console.log(`[Gateway] ✅ 快取項目已刪除（內存 + Local 已同步）`);
            sendResponse({ status: "success", message: `快取已刪除: "${userInput}"` });
            return true;
        }
        
        // ====== 音頻轉錄 API (Google Generative AI) ======
        if (request.action === "transcribeAudio") {
            console.log("[Gateway] 📻 處理音頻轉錄請求");
            handleAudioTranscription(request, sendResponse);
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

// 處理音頻轉錄請求 (Google Generative AI)
async function handleAudioTranscription(request, sendResponse) {
    try {
        console.log("[Gateway] 🎤 開始處理音頻轉錄");
        
        const { audioData, mimeType, fileName, language } = request;
        const apiKey = await getGoogleApiKey();
        
        if (!apiKey) {
            console.error("[Gateway] ❌ 未配置 Google API Key");
            sendResponse({ 
                success: false, 
                error: "未配置 Google API Key，請在設置中添加" 
            });
            return;
        }
        
        console.log("[Gateway] 📤 調用 Google Generative AI API");
        console.log("[Gateway] 音檔格式:", mimeType);
        console.log("[Gateway] 轉錄語言:", language || 'zh-TW');
        
        // 構建 API 請求
        const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
        
        const requestBody = {
            contents: [{
                parts: [
                    {
                        text: `請幫我對這段音訊製作詳細的逐字稿，並標註說話者（如果有多人）與時間點。語言使用：${
                            language === 'zh-CN' ? '簡體中文' :
                            language === 'en-US' ? 'English (US)' :
                            language === 'en-GB' ? 'English (UK)' :
                            language === 'ja-JP' ? '日本語' :
                            language === 'ko-KR' ? '한국어' :
                            '繁體中文'
                        }`
                    },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: audioData
                        }
                    }
                ]
            }]
        };
        
        const response = await fetch(`${apiUrl}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                `Google API 錯誤 (${response.status}): ${
                    errorData.error?.message || response.statusText
                }`
            );
        }
        
        const result = await response.json();
        
        // 提取轉錄結果
        if (result.candidates && result.candidates[0] && result.candidates[0].content) {
            const transcript = result.candidates[0].content.parts
                .map(part => part.text)
                .join('\n');
            
            console.log("[Gateway] ✅ 轉錄成功，長度:", transcript.length);
            sendResponse({ 
                success: true, 
                transcript: transcript 
            });
        } else {
            throw new Error("API 返回格式不正確");
        }
        
    } catch (error) {
        console.error("[Gateway] ❌ 轉錄失敗:", error);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    }
}

// 獲取 Google API Key (從 Chrome storage 或 config)
async function getGoogleApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['googleApiKey'], (result) => {
            if (result.googleApiKey) {
                console.log("[Gateway] ✅ 找到 Google API Key");
                resolve(result.googleApiKey);
            } else {
                console.warn("[Gateway] ⚠️ 未找到 Google API Key");
                resolve(null);
            }
        });
    });
}

// --- 階段 B & C：接收指令、思考與調度 ---
async function handleRequest(userPrompt, sendResponse, configData = null, senderTab = null) {
    try {
        console.log("[Gateway] ╔════════════════════════════════════════╗");
        console.log("[Gateway] ║  新請求開始處理                        ║");
        console.log("[Gateway] ╚════════════════════════════════════════╝");
        console.log("[Gateway] 用戶提示詞:", userPrompt);
        console.log("[Gateway] senderTab:", senderTab ? `ID: ${senderTab.id}` : '❌ 不存在');
        console.log("[Gateway] 配置對象是否存在:", !!configData);
        
        if (!configData) {
            console.error("[Gateway] ❌ configData 為 null/undefined");
            sendResponse({ status: "error", text: "❌ 未提供配置文件，無法執行 AI 功能" });
            return;
        }

        await ensureSkillsLoaded();
        
        // ====== 阶段 B：检查快取 ======
        console.log("[Gateway] ═══ 階段 B：檢查快取 ═══");
        const cachedResult = getFromCache(userPrompt);
        if (cachedResult) {
            console.log("[Gateway] ✅ 快取命中！跳過 AI 推理");
            console.log("[Gateway] 使用快取結果:", cachedResult);
            
            // 獲取技能信息
            const skillInfo = SKILL_MAPPINGS[cachedResult.skill];
            if (!skillInfo) {
                console.error("[Gateway] ❌ 快取中的技能已不存在:", cachedResult.skill);
                sendResponse({ status: "error", text: `技能已被移除: ${cachedResult.skill}` });
                return;
            }
            
            // 準備執行 - 需要重新獲取當前 tab 信息
            let activeTab = null;
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    activeTab = tab;
                }
            } catch (error) {
                console.warn(`[Gateway] 無法查詢標籤頁:`, error);
            }
            
            const tabId = activeTab?.id || null;
            const title = activeTab?.title || null;
            const skillArgs = cachedResult.args || {};
            skillArgs.tabId = tabId;  // 確保 tabId 是最新的
            skillArgs.title = title;  // 確保 title 是最新的
            
            // 添加必要的 args
            if (!skillArgs.modelName && configData) {
                skillArgs.modelName = MODEL_NAMES[configData.activeModel] || configData.activeModel || 'Unknown Model';
            }
            
            if (!skillArgs.language) {
                try {
                    const langSettings = await chrome.storage.sync.get('micLanguage');
                    skillArgs.language = langSettings.micLanguage || 'zh-TW';
                } catch (error) {
                    skillArgs.language = 'zh-TW';
                }
            }
            
            // 轉發給 SidePanel 執行
            await runSkillInSidePanel(cachedResult.skill, skillInfo, skillArgs, sendResponse, configData);
            return;
        }
        
        console.log("[Gateway] ═══ 階段 C：呼叫 AI 模型 ═══");
        console.log("[Gateway] 接收到的 config:", JSON.stringify(configData, null, 2));
        console.log("[Gateway] activeModel 值:", configData.activeModel);
        console.log("[Gateway] activeModel 類型:", typeof configData.activeModel);
        console.log("[Gateway] 可用技能:", Object.keys(SKILL_REGISTRY));
        
        const aiResponse = await callAIModel(userPrompt, dynamicSystemPrompt, configData);
        
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
        
        // ====== 快取 AI 推理結果 ======
        // 將用戶輸入和 AI 推理結果存入快取，以便下次使用相同輸入時可直接使用快取
        putInCache(userPrompt, {
            skill: command.skill,
            args: command.args || {}
        });
        
        // ===== 新的統一流程：所有技能都通過 SidePanel 執行 =====
        // 第一步：自動獲取當前活跃標籤頁的 tabId
        let activeTab = null;
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                activeTab = tab;
                console.log(`[Gateway] 獲取當前活跃標籤頁: ID=${tab.id}, URL=${tab.url}`);
            } else {
                console.warn(`[Gateway] 找不到活跃標籤頁`);
            }
        } catch (error) {
            console.warn(`[Gateway] 無法查詢標籤頁:`, error);
        }
        
        // 第二步：準備轉發給 SidePanel 的參數
        const skillArgs = command.args || {};
        const tabId = activeTab?.id || null;
        
        // 如果 tabId 是占位符或不存在，用實際的 tabId 替換
        if (tabId && (skillArgs.tabId === "ACTIVE_TAB" || !skillArgs.tabId)) {
            skillArgs.tabId = tabId;
            skillArgs.title = activeTab.title || 'unknown_page';  // 同時傳遞標題
            console.log(`[Gateway] 將 tabId 注入/替換到 args: ${tabId}`);
        }
        
        // 如果 url 是占位符或不存在，用實際的 url 替換
        if (activeTab && activeTab.url && (skillArgs.url === "ACTIVE_TAB_URL" || !skillArgs.url)) {
            skillArgs.url = activeTab.url;
            console.log(`[Gateway] 將 url 注入/替換到 args: ${activeTab.url}`);
        }
        
        // 第三步：轉發給 SidePanel（統一入口）
        await runSkillInSidePanel(command.skill, skillInfo, skillArgs, sendResponse, configData);
        
    } catch (error) {
        console.error("[Gateway] 執行失敗:", error);
        sendResponse({ status: "error", text: error.message });
    }
}

// --- 統一的技能執行入口：轉發給 SidePanel ---
// 說明：所有技能（無論 runInPageContext 值）都通過此函數轉發給 SidePanel
// SidePanel 根據 runInPageContext 標志決定執行方式
async function runSkillInSidePanel(skillName, skillInfo, args, sendResponse, configData) {
    try {
        console.log(`[Gateway] 將技能轉發給 SidePanel 執行: ${skillName}`);
        console.log(`[Gateway] 傳遞的參數:`, args);
        console.log(`[Gateway] runInPageContext: ${skillInfo.runInPageContext}`);
        
        // 確保 args 是一個對象，如果沒有參數則初始化為空對象
        if (!args) {
            args = {};
        }
        
        // 添加當前模型名稱到 args
        if (!args.modelName && configData) {
            args.modelName = MODEL_NAMES[configData.activeModel] || configData.activeModel || 'Unknown Model';
            console.log(`[Gateway] 添加 modelName: ${args.modelName}`);
        }
        
        // 添加當前語言到 args
        if (!args.language) {
            try {
                const langSettings = await chrome.storage.sync.get('micLanguage');
                args.language = langSettings.micLanguage || 'zh-TW';
                console.log(`[Gateway] 添加 language: ${args.language}`);
            } catch (error) {
                console.warn(`[Gateway] 無法獲取語言設定:`, error);
                args.language = 'zh-TW';  // 默認繁體中文
            }
        }
        
        // 調用 SidePanel 執行技能，傳遞 runInPageContext 和 tabId
        const result = await executeSidePanelSkill(
            skillName, 
            skillInfo.folder, 
            args,
            skillInfo.runInPageContext,  // ← 傳遞執行環境標誌
        );
        
        console.log(`[Gateway] 技能 ${skillName} 執行結果:`, result);
        
        // 發送成功通知（通過消息傳遞）
        try {
            await chrome.runtime.sendMessage({
                action: 'SHOW_NOTIFICATION',
                type: 'success',
                skillName: skillName,
                messageKey: 'notification.skill.success'
            });
        } catch (error) {
            console.warn('[Gateway] 發送通知失敗:', error);
        }
        
        sendResponse({ status: "success", text: result });
        
    } catch (error) {
        console.error(`[Gateway] 技能執行失敗:`, error);
        
        // 發送失敗通知（通過消息傳遞）
        try {
            await chrome.runtime.sendMessage({
                action: 'SHOW_NOTIFICATION',
                type: 'error',
                skillName: skillName,
                messageKey: 'notification.skill.error',
                errorMessage: error.message
            });
        } catch (notifyError) {
            console.warn('[Gateway] 發送失敗通知失敗:', notifyError);
        }
        
        sendResponse({ status: "error", text: `技能執行失敗: ${error.message}` });
    }
}

// --- 統一 AI 模型調用入口 ---
/**
 * 根據配置選擇合適的 AI 模型並調用
 * @param {string} userPrompt - 用戶輸入
 * @param {string} systemPrompt - 系統提示詞
 * @param {object} configData - 配置數據（包含 activeModel 和各模型配置）
 * @returns {Promise<string>} - AI 回應文本
 */
async function callAIModel(userPrompt, systemPrompt, configData) {
    try {
        let aiResponse;
        
        if (configData.activeModel === 'ollamaGemma2B') {
            console.log("[Gateway] ✅ 選擇使用 Ollama Gemma 2B 模型 (小模型)");
            console.log("[Gateway] Ollama 配置:", JSON.stringify(configData.ollamaGemma2B, null, 2));
            aiResponse = await callOllama(userPrompt, systemPrompt, configData.ollamaGemma2B);
        } else if (configData.activeModel === 'ollamaGemmaLarge') {
            console.log("[Gateway] ✅ 選擇使用 Ollama Gemma Large 模型 (大模型)");
            console.log("[Gateway] Ollama 配置:", JSON.stringify(configData.ollamaGemmaLarge, null, 2));
            aiResponse = await callOllama(userPrompt, systemPrompt, configData.ollamaGemmaLarge);
        } else if (configData.activeModel === 'ollamaMinimaxM2') {
            console.log("[Gateway] ✅ 選擇使用 Ollama Minimax M2 模型");
            console.log("[Gateway] Ollama 配置:", JSON.stringify(configData.ollamaMinimaxM2, null, 2));
            aiResponse = await callOllama(userPrompt, systemPrompt, configData.ollamaMinimaxM2);
        } else {
            console.log("[Gateway] ✅ 選擇使用 Gemini 2.5 Flash 模型");
            
            // 🆕 從 storage 讀取儲存的 Gemini API Key
            let geminiConfig = { ...configData.geminiFlash };
            try {
                const storedApiKey = await chrome.storage.local.get('geminiApiKey');
                if (storedApiKey.geminiApiKey) {
                    geminiConfig.apiKey = storedApiKey.geminiApiKey;
                    console.log("[Gateway] ✅ 已從 storage 載入 Gemini API Key");
                }
            } catch (error) {
                console.warn("[Gateway] ⚠️ 無法從 storage 讀取 API Key:", error);
                // 繼續使用 configData.geminiFlash.apiKey（如果有的話）
            }
            
            console.log("[Gateway] Gemini 配置:", JSON.stringify({...geminiConfig, apiKey: '***'}));
            aiResponse = await callGeminiFlash(userPrompt, systemPrompt, geminiConfig);
        }
        
        console.log("[Gateway] AI 原始回應 (長度:", aiResponse.length, "):", aiResponse);
        console.log("[Gateway] AI 回應前 200 字:", aiResponse.substring(0, 200));
        console.log("[Gateway] AI 回應後 200 字:", aiResponse.substring(Math.max(0, aiResponse.length - 200)));
        
        return aiResponse;
    } catch (error) {
        console.error("[Gateway] AI 模型調用失敗:", error);
        throw error;
    }
}

// --- 在網頁前端執行技能的輔助函數 ---
// 這個函數會被注入到網頁中執行
async function executeSkillInPage(skillName , args, skillUrl) {
    try {
        console.log(`[PageContext] 開始執行技能: ${skillName}`);
        console.log(`[PageContext] 技能 URL: ${skillUrl}`);
        
        // 動態 import skill 模組 (使用傳入的完整 URL)
        const skillModule = await import(skillUrl);
        
        // 獲取 skill 函數
        const skillFunc = skillModule[skillName];
        if (typeof skillFunc !== 'function') {
            throw new Error(`技能模組中未找到函數: ${skillName}`);
        }
        
        // 執行 skill 函數
        console.log(`[PageContext] 執行 ${skillName}，參數:`, args);
        const result = await skillFunc(args);
        
        console.log(`[PageContext] ${skillName} 執行成功:`, result);
        return {
            status: "success",
            result: result
        };
    } catch (error) {
        console.error(`[PageContext] ${skillName} 執行失敗:`, error);
        return {
            status: "error",
            error: error.message
        };
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