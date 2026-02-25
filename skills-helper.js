// skills-helper.js - 在 sidepanel 上下文中動態加載和執行技能
// 這個文件運行在 sidepanel 的上下文中，可以使用 fetch 和動態加載

console.log("[Skills Helper] 已初始化");

// 監聽來自 service-worker 的技能執行請求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Skills Helper] 收到訊息:", request.action);
    
    if (request.action === "execute_skill_in_helper") {
        executeSkillDynamically(request.skillName, request.skillFolder, request.args)
            .then(result => {
                sendResponse({ status: "success", result: result });
            })
            .catch(error => {
                sendResponse({ status: "error", error: error.message });
            });
        
        return true; // 表示非同步回應
    }
});

// 動態加載並執行技能
async function executeSkillDynamically(skillName, skillFolder, args) {
    console.log(`[Skills Helper] 加載技能: ${skillName}`);
    
    try {
        // 1. 動態加載 .js 文件（使用 import() 因為我們在 sidepanel 上下文中）
        const skillPath = `./skills/${skillFolder}/${skillName}.js`;
        console.log(`[Skills Helper] 動態導入: ${skillPath}`);
        
        // 由於我們在 sidepanel 上下文中（非 Service Worker），可以使用 import()
        const skillModule = await import(skillPath);
        console.log(`[Skills Helper] 技能模塊已加載`);
        
        // 2. 檢查是否導出了 run 函數
        if (typeof skillModule.run !== 'function') {
            throw new Error(`技能模塊未導出 run 函數`);
        }
        
        // 3. 調用技能的 run 函數
        console.log(`[Skills Helper] 執行技能函數: ${skillName}`);
        const result = await skillModule.run(args);
        console.log(`[Skills Helper] 技能 ${skillName} 執行完成`);
        
        return result;
        
    } catch (error) {
        console.error(`[Skills Helper] 技能執行失敗:`, error);
        throw error;
    }
}
