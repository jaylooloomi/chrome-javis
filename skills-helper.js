// skills-helper.js - 在 sidepanel 上下文中動態加載和執行技能
// 這個文件運行在 sidepanel 的上下文中，可以使用 fetch 和 eval

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
        // 1. 動態加載 .js 文件
        const skillPath = `skills/${skillFolder}/${skillName}.js`;
        console.log(`[Skills Helper] 加載文件: ${skillPath}`);
        
        const skillResponse = await fetch(chrome.runtime.getURL(skillPath));
        if (!skillResponse.ok) {
            throw new Error(`技能文件加載失敗: ${skillResponse.status}`);
        }
        
        const skillCode = await skillResponse.text();
        console.log(`[Skills Helper] 文件已加載，大小: ${skillCode.length} 字符`);
        
        // 2. 在當前上下文中執行代碼
        // 創建一個獨立的作用域來執行技能代碼
        const skillModule = {};
        const executeCode = `(function() {
            ${skillCode}
        }).call(skillModule);`;
        
        eval(executeCode);
        
        // 3. 調用技能的執行函數
        // 技能代碼應該定義一個全局的執行函數
        const functionName = `run${skillName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')}Skill`;
        
        // 先嘗試找到在全局作用域中定義的函數
        if (typeof window[functionName] === 'function') {
            const result = await window[functionName](args);
            console.log(`[Skills Helper] 技能 ${skillName} 執行完成`);
            return result;
        } else {
            throw new Error(`未找到技能執行函數: ${functionName}`);
        }
        
    } catch (error) {
        console.error(`[Skills Helper] 技能執行失敗:`, error);
        throw error;
    }
}
