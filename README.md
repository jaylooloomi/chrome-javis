📝 OmniAssistant - Chrome Extension AI Agent (Manifest V3)

## 核心架構 (System Architecture)

### 🎯 設計哲學：二層分離模式

**Service Worker 當純轉發器，SidePanel 當執行大腦**

這是解決 Service Worker ES Module 限制的優雅方案：
- Service Worker **無法使用動態 `import()`**（HTML 規範限制）
- SidePanel 是完整網頁環境，**完全支援動態 `import()`** 和 DOM 操作
- 結果：架構更乾淨，技能加載更靈活

```
用戶指令 (SidePanel UI)
        ↓
  Service Worker (消息路由層)
  - 接收訊息
  - 呼叫 Gemini 2.0 Flash API
  - 解析 AI 回應
  - 轉發到 SidePanel
        ↓
   SidePanel (執行引擎)
  - 動態載入技能模組
  - 執行技能邏輯
  - 返回結果
        ↓
  Chrome APIs / DOM 操作
```

---

## 完整操作流程 (Operational Flow)

### 階段 A：初始化 (Startup)

**service-worker.js 啟動時：**

1. **讀取技能清單**
   - 從 `skills-manifest.json` 掃描所有可用技能
   - 建立 `SKILL_MAPPINGS` 對應表

2. **構建系統提示詞**
   - 讀取每個技能的 `.md` 檔案
   - 拼接成完整的 System Prompt
   - 存在 `dynamicSystemPrompt` 變數中

### 階段 B：指令接收與 AI 推理 (Input & Reasoning)

**用戶在 SidePanel 說「打開 Google」：**

```
SidePanel (用戶說話)
    ↓
Service Worker 收到訊息
    ↓
[Gateway Phase]
- 提取用戶的自然語言輸入
- 組合 System Prompt + User Prompt
- 發送到 Gemini 2.0 Flash API
    ↓
Gemini 回應 (JSON)
{
  "skill": "open_tab",
  "url": "https://www.google.com"
}
    ↓
Service Worker 解析 JSON
    ↓
決定技能執行環境
  ├─ 需要 DOM？ → 轉發到 SidePanel
  └─ 純 API？ → 直接轉發到 SidePanel
```

### 階段 C：動態加載與執行 (Execution)

**Service Worker 轉發到 SidePanel：**

```javascript
// service-worker.js
chrome.runtime.sendMessage({
    target: 'SIDE_PANEL',
    type: 'EXECUTE_SKILL',
    skill: 'open_tab',
    skillFolder: 'opentab',
    args: { url: 'https://www.google.com' }
});
```

**SidePanel 動態執行技能：**

```javascript
// sidepanel.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target === 'SIDE_PANEL' && message.type === 'EXECUTE_SKILL') {
        (async () => {
            try {
                // ✨ 核心：動態 import（只有在 SidePanel 才被允許）
                const module = await import(
                    `./skills/${message.skillFolder}/${message.skill}.js`
                );
                
                // 執行技能函數
                const skillFunc = module[message.skill];
                const result = await skillFunc(message.args);
                
                sendResponse({ status: "success", result });
            } catch (error) {
                sendResponse({ status: "error", error: error.message });
            }
        })();
        
        return true; // ✨ 保持消息通道開啟
    }
});
```

**技能執行：**

```javascript
// skills/opentab/open_tab.js
export async function open_tab(args) {
    const url = args.url.startsWith('http') 
        ? args.url 
        : `https://${args.url}.com`;
    
    const tab = await chrome.tabs.create({ url });
    return `✅ 成功開啟分頁：${url}`;
}
```

---

## 技能系統規範 (Skill System Spec)

### 檔案結構

每個技能必須遵循此結構：

```
skills/
├── opentab/
│   ├── open_tab.md          # AI 用的介面定義
│   └── open_tab.js          # 實作檔（標準 ES Module）
├── summarize/
│   ├── summarize_page.md
│   └── summarize_page.js
└── ...
```

### 1. 介面定義 (`.md` 檔案)

給 AI 看的說明書，格式自由，但必須讓 Gemini 理解技能的用途：

```markdown
# open_tab

打開新分頁的技能。

## 參數
- url: (string) 要開啟的網址

## 返回
成功訊息字串
```

### 2. 實作檔 (`.js` 檔案)

**必須導出與檔案名相同的 async 函數：**

```javascript
// skills/opentab/open_tab.js
export async function open_tab(args) {
    // args 包含所有 AI 決定的參數
    // 例如: { url: "https://www.google.com" }
    
    try {
        // 執行邏輯
        const tab = await chrome.tabs.create({ url: args.url });
        
        // 返回執行結果訊息
        return `✅ 成功開啟分頁：${args.url}`;
    } catch (error) {
        throw new Error(`開啟分頁失敗：${error.message}`);
    }
}
```

### 3. 技能清單 (skills-manifest.json)

註冊所有可用技能：

```json
{
  "skills": [
    {
      "name": "open_tab",
      "folder": "opentab",
      "description": "打開新分頁",
      "runInPageContext": false
    }
  ]
}
```

---

## 關鍵技術細節 (Technical Deep Dive)

### 為什麼 SidePanel 是完美的執行引擎？

| 特性 | Service Worker | SidePanel | 網頁上下文 |
|------|-----------------|-----------|---------|
| **動態 import()** | ❌ HTML 規範禁止 | ✅ 支援 | ✅ 支援 |
| **DOM 存取** | ❌ 無 DOM | ✅ 完整 | ✅ 完整 |
| **window 物件** | ❌ 無 | ✅ 有 | ✅ 有 |
| **Chrome APIs** | ✅ 完全支援 | ✅ 完全支援 | ⚠️ 有限 |
| **生命週期** | 👻 隨時睡眠 | 👤 用戶開啟時活躍 | 📄 分頁級別 |

### 非同步通訊的正確模式

```javascript
// ❌ 錯誤（會導致消息通道關閉）
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    const result = await doSomethingAsync();
    sendResponse(result); // 通道已關閉！
});

// ✅ 正確（保持通道開啟）
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        const result = await doSomethingAsync();
        sendResponse(result); // 通道仍然開啟
    })();
    return true; // 必須返回 true！
});
```

---

## 消息流協議 (Message Protocol)

### Service Worker → SidePanel

```javascript
{
    target: 'SIDE_PANEL',           // 目標模組
    type: 'EXECUTE_SKILL',          // 操作類型
    skill: 'open_tab',              // 技能名稱
    skillFolder: 'opentab',         // 技能資料夾
    args: {                         // AI 決定的參數
        url: 'https://www.google.com'
    }
}
```

### SidePanel → Service Worker (回應)

**成功：**
```javascript
{
    status: 'success',
    result: '✅ 成功開啟分頁：https://www.google.com'
}
```

**失敗：**
```javascript
{
    status: 'error',
    error: '開啟分頁失敗：Invalid URL'
}
```

---

## 開發工作流程 (Development Workflow)

### 添加新技能的步驟

1. **建立檔案結構**
   ```
   skills/myskill/
   ├── myskill.md
   └── myskill.js
   ```

2. **編寫 .md 介面**
   ```markdown
   # myskill
   
   技能的用途說明...
   ```

3. **編寫 .js 實作**
   ```javascript
   export async function myskill(args) {
       // 技能邏輯
       return "執行結果";
   }
   ```

4. **註冊到 skills-manifest.json**
   ```json
   {
       "name": "myskill",
       "folder": "myskill",
       "description": "技能描述",
       "runInPageContext": false
   }
   ```

5. **完成！** 系統會自動發現並加載新技能

---

## 架構優勢總結 (Benefits)

✅ **零硬編碼** - Service Worker 不需要 import 任何技能  
✅ **完全動態** - 新增技能自動被發現  
✅ **符合規範** - 避免 HTML 規範和 CSP 限制  
✅ **清晰職責** - Service Worker 是路由器，SidePanel 是執行器  
✅ **易於測試** - 技能是獨立的 ES Module，可單獨測試  
✅ **可擴展** - 未來可輕鬆添加 DOM 操作、複雜邏輯等  

---

## 故障排除 (Troubleshooting)

### 「無法連接到 SidePanel」

**原因：** SidePanel 未開啟或 Chrome 未加載

**解決：** 
1. 確保 SidePanel 已打開（用戶應主動打開）
2. 檢查 Chrome DevTools Console 是否有錯誤

### 「動態 import 失敗」

**原因：** 路徑錯誤或檔案不存在

**解決：**
1. 檢查 `skills-manifest.json` 中的 `folder` 名稱
2. 確保檔案名與函數名一致
3. 檢查 SidePanel Console 的詳細錯誤訊息

### 「技能未被註冊」

**原因：** 技能檔案沒有正確導出

**解決：**
```javascript
// ✅ 必須是這樣
export async function skillname(args) { ... }

// ❌ 不要這樣
export default async function(args) { ... }
function skillname(args) { ... }  // 沒有 export
```

---

## 專案狀態 (Project Status)

- ✅ Service Worker 路由架構完成
- ✅ SidePanel 執行引擎實作
- ✅ Gemini 2.0 Flash 整合
- ✅ open_tab 技能示例完成
- 📋 計畫中：summarize_page 技能