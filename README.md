📝 OmniAssistant - Chrome Extension AI Agent (Manifest V3)

一個具備多技能的智能 Chrome 助手，採用 **Gateway-Client 微服務模式**，支持 12 種語言，可擴展的技能系統。

## 核心架構 (System Architecture)

### 🎯 Gateway-Client 模式 (Gateway-Client Pattern)

這是一種微服務架構模式，特別適合 Chrome 擴展的限制環境。

**架構層次：**

```
┌─ Gateway Layer ─────────────────┐
│  Service Worker                 │
│  - 調用 Gemini API              │
│  - AI 推理與決策                 │
│  - 解析 JSON 指令                │
│  - 路由到 Client                 │
└─────────────────────────────────┘
              ↓
┌─ Client Layer ──────────────────┐
│  SidePanel                      │
│  - 動態加載技能模組              │
│  - 執行業務邏輯                  │
│  - 調用 Chrome APIs              │
│  - 與用戶界面交互                │
└─────────────────────────────────┘
```

**為什麼這樣分離？**

| 特性 | Service Worker | SidePanel | 
|------|-----------------|----------|
| **動態 import()** | ❌ HTML 規範禁止 | ✅ 完全支援 | 
| **DOM 存取** | ❌ 無 | ✅ 有 | 
| **Chrome APIs** | ✅ 完全支援 | ✅ 完全支援 | 
| **生命週期** | 👻 隨時睡眠 | 👤 用戶開啟時活躍 | 
| **複雜邏輯** | ⚠️ 受限 | ✅ 完整網頁環境 | 

**優勢：**
- ✅ Service Worker 無需 hardcode 任何技能
- ✅ SidePanel 可以動態加載任何技能模組
- ✅ 符合 Chrome 規範，避免 CSP 衝突
- ✅ 職責清晰，易於維護和測試
- ✅ 可輕鬆擴展新功能

### 🎯 設計哲學：大腦-手腳分離模式

**Service Worker 當大腦（AI 推理和決策），SidePanel 當手腳（動態執行技能）**

Service Worker 負責思考決策，SidePanel 負責行動執行：
- Service Worker **大腦**：調用 Gemini API，進行 AI 推理，決定執行哪個技能
- SidePanel **手腳**：動態加載技能，執行業務邏輯，與 Chrome APIs 和 DOM 互動
- 結果：職責清晰，易於維護，模組化程度高

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

### 階段 B：指令接收、AI 推理與路由 (Input, Reasoning & Routing)

**用戶在 SidePanel 說「打開 Google」：**

```
SidePanel (用戶說話)
    ↓
Service Worker 收到訊息
    ↓
[Gateway Phase - 大腦思考和決策]
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
Service Worker 解析 JSON，查詢技能清單
    ↓
檢索 runInPageContext 標誌
{
  skill: "open_tab",
  runInPageContext: false
}
    ↓
轉發給 SidePanel（包含執行環境指示）
{
  skill: "open_tab",
  runInPageContext: false,
  args: { url: "https://www.google.com" }
}
```

### 階段 C：動態加載與執行 (Execution)

**Service Worker 轉發到 SidePanel：**

```javascript
// service-worker.js
chrome.runtime.sendMessage({
    target: 'SIDE_PANEL',
    type: 'EXECUTE_SKILL',
    skill: 'open_tab',
    skillFolder: 'open_tab',
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
// skills/open_tab/open_tab.js
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
├── open_tab/
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

註冊所有可用技能（位置：`skills/skills-manifest.json`）：

```json
{
  "skills": [
    {
      "name": "open_tab",
      "folder": "open_tab",
      "description": "打開新標籤頁",
      "runInPageContext": false
    },
    {
      "name": "summarize_this_page",
      "folder": "summarize_this_page",
      "description": "分析並總結當前頁面",
      "runInPageContext": false
    },
    {
      "name": "close_this_page",
      "folder": "close_this_page",
      "description": "關閉當前標籤頁",
      "runInPageContext": false
    },
    {
      "name": "who_are_you",
      "folder": "who_are_you",
      "description": "介紹 Jarvis 助手功能",
      "runInPageContext": false
    }
  ]
}
```

---

## 📚 當前支持的技能 (Supported Skills)

### 1. open_tab - 打開新標籤頁

**功能**：打開指定網站到新標籤頁

**觸發規則**：
- 必須有動詞：\"open\", \"visit\", \"go to\", \"check\", \"打開\", \"訪問\"
- 必須有網站名：\"Google\", \"YouTube\", \"Gmail\", \"Setting\" 等

**示例指令**：
- \"open Google\"
- \"visit YouTube Music\"
- \"打開 Gmail\"
- \"open setting\" (打開設定頁面)

**支持的網站**：Google, YouTube, YouTube Music, GitHub, Twitter, LinkedIn, Facebook, Instagram, Yahoo, Gmail, Setting

### 2. summarize_this_page - 分析並總結頁面

**功能**：將當前頁面發送到 Google Gemini 進行分析、摘要或評估

**觸發規則**：
- 必須有動詞：\"ask\", \"send\", \"analyze\", \"summarize\", \"分析\", \"總結\", \"檢查\"
- 必須有對象：\"this page\", \"current page\", \"頁面\" 或隱含當前頁面

**示例指令**：
- \"analyze this page\"
- \"summarize current page\"
- \"分析頁面\"
- \"重點整理一下\"

### 3. close_this_page - 關閉當前標籤頁

**功能**：立即關閉當前所在的瀏覽器標籤頁

**觸發規則**：
- 必須有動詞：\"close\", \"shut\", \"quit\", \"exit\", \"關閉\", \"關掉\", \"退出\"
- 必須有對象：\"this page\", \"this tab\", \"current tab\", \"頁面\" 或隱含當前頁面

**示例指令**：
- \"close this page\"
- \"close current tab\"
- \"關閉頁面\"
- \"退出\"

### 4. who_are_you - 介紹助手

**功能**：介紹 Jarvis 助手的功能、當前使用的 AI 模型和語言設置

**觸發規則**：
- 用戶詢問關於助手的問題

**示例指令**：
- \"who are you?\"
- \"你是誰?\"
- \"你能做什麼?\"
- \"tell me about yourself\"

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
    skillFolder: 'open_tab',        // 技能資料夾
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

## ⚙️ 配置說明 (Configuration)

### 模型選擇

用戶可以在 **選項頁面** (`chrome-extension://llffkjaidimijhnkgpacebjkiicccaaj/options.html`) 選擇 AI 模型：

**支持的模型**：
- 🌐 **Gemini 2.5 Flash** (雲端) - 快速、準確、需要網絡
- 🖥️ **Ollama Gemma 2B** (本地) - 隱私安全、速度較慢
- 🖥️ **Ollama Gemma Large** (本地) - 效果更好、需更多資源
- 🖥️ **Ollama Minimax M2** (本地) - 多語言支持

選擇會保存到 `chrome.storage.sync`，並在技能執行時作為上下文參數傳遞。

### 語言設置

系統會自動檢測瀏覽器語言。用戶也可以在選項頁面手動選擇語言。

### 通知設置

用戶可以在選項頁面啟用/禁用技能執行完成後的 toast 通知。

---

## 🌐 國際化支持 (i18n)

OmniAssistant 支持 **12 種語言**：

| 語言 | 代碼 | 狀態 |
|------|------|------|
| 繁體中文 | zh-TW | ✅ |
| 簡體中文 | zh-CN | ✅ |
| 英文 (美國) | en-US | ✅ |
| 日文 | ja-JP | ✅ |
| 韓文 | ko-KR | ✅ |
| 法文 | fr-FR | ✅ |
| 德文 | de-DE | ✅ |
| 西班牙文 | es-ES | ✅ |
| 義大利文 | it-IT | ✅ |
| 葡萄牙文 (巴西) | pt-BR | ✅ |
| 泰文 | th-TH | ✅ |
| 俄文 | ru-RU | ✅ |

所有 UI 字符串都存儲在 `i18n/locales.json` 中，系統會根據用戶語言自動選擇翻譯。

---

## 📖 開發指南 (Development Guide)

### 🚀 快速建立新技能 (Quick Skill Creation)

給 AI 建立新技能的提示詞：

```
📄 参考 SKILL_DEVELOPMENT.md
📁 创建 skills/skill_name/ 文件夹
📝 写 .md 定义和 .js 实现
✨ 完成！Pre-commit hook 自动注册
```

**工作流程：**
1. 閱讀 [SKILL_DEVELOPMENT.md](SKILL_DEVELOPMENT.md) 了解統一的技能開發架構
2. 在 `skills/` 下建立新的技能資料夾：`skills/your_skill_name/`
3. 編寫 `.md` 文件（AI 介面定義）和 `.js` 文件（實現代碼）
4. 完成！Pre-commit hook 會自動將您的技能註冊到清單中

### 添加新技能的完整步驟

#### 第 1 步：建立檔案結構

在 `skills/` 目錄下建立新技能資料夾：

```
skills/
├── myskill/
│   ├── myskill.md          # AI 用的介面定義
│   └── myskill.js          # 技能實現代碼
└── ...
```

#### 第 2 步：編寫 .md 介面文件

這個文件告訴 AI 技能的用途和參數。建議參考現有技能（如 `open_tab.md`）的格式：

```markdown
name: myskill

description: 技能的簡短描述

when_to_use:
  MUST HAVE BOTH:
  1. **ACTION VERB** (必須有動詞):
     English: "verb1", "verb2"
     Chinese: "動詞1", "動詞2"
  
  2. **CONTEXT/OBJECT** (必須有對象):
     "context1", "context2"

examples_CORRECT:
  - "example 1" ✓
  - "example 2" ✓

examples_INCORRECT:
  - "bad example 1" ✗

when_NOT_to_use:
  - 不應使用的情況

input: 輸入格式說明

output:
JSON 格式輸出說明和範例

IMPORTANT:
- 重要提示和限制
```

**提示**：這個 .md 文件會被放入 AI 的 System Prompt，所以要清楚易懂！

#### 第 3 步：編寫 .js 實現文件

**關鍵要求**：
1. 必須導出與檔案名相同的 `async` 函數
2. 函數名必須完全匹配技能名稱
3. 使用 ES Module 語法 (`export async function`)
4. 接收 `args` 參數物件
5. 返回描述性的成功訊息
6. 拋出有意義的錯誤訊息

```javascript
// skills/myskill/myskill.js
// ✅ 正確的模板

export async function myskill(args) {
    console.log("[MySkill] 啟動，接收到參數:", args);

    try {
        // 驗證必要參數
        if (!args.requiredParam) {
            throw new Error("未提供必要參數: requiredParam");
        }

        console.log("[MySkill] 執行業務邏輯...");
        
        // 業務邏輯
        const result = await someAsyncOperation(args.requiredParam);
        
        console.log("[MySkill] 執行成功");
        return `✅ 操作成功：${result}`;
        
    } catch (error) {
        console.error("[MySkill] 錯誤:", error);
        throw new Error(`操作失敗：${error.message}`);
    }
}
```

**參數規範**：
- `args.modelName` - 當前使用的 AI 模型名稱
- `args.language` - 當前的語言代碼 (如 \"zh-TW\")
- `args.tabId` - 源標籤頁 ID (如果需要)
- `args.url` - 源頁面 URL (如果需要)
- 其他參數由 AI 根據 `.md` 文件決定

#### 第 4 步：註冊技能到清單

編輯 `skills/skills-manifest.json` 並新增技能條目：

```json
{
  "skills": [
    {
      "name": "myskill",
      "folder": "myskill",
      "description": "技能的簡短描述",
      "runInPageContext": false
    }
  ]
}
```

#### 第 5 步：測試

1. 重新載入擴展 (`chrome://extensions/`)
2. 打開 Service Worker 日誌，驗證技能是否被加載
3. 在 SidePanel 中測試新指令
4. 檢查 SidePanel Console 查看執行日誌

#### 第 6 步：完成！

系統會自動發現並加載新技能。無需修改任何核心代碼！

### 技能編寫最佳實踐

✅ **DO:**
- 使用清晰的控制台日誌 `console.log("[SkillName] 訊息")`
- 驗證所有輸入參數
- 提供有意義的錯誤訊息
- 使用 try-catch 處理所有異步操作
- 返回人類可讀的成功訊息
- 在 .md 文件中提供清晰的使用規則

❌ **DON'T:**
- 不要使用 `console.error` 作為正常流程
- 不要返回空或 undefined
- 不要忘記 `export async function`
- 不要修改全局狀態
- 不要在技能中硬編碼配置值

---

## 🐛 調試方法 (Debugging)

### 查看 Service Worker (Gateway) 日誌

1. 打開 `chrome://extensions/`
2. 找到 \"OmniAssistant\"
3. 點擊 \"Service Worker\" 下方的藍色文字（不是切換開關）
4. DevTools 會打開，查看 **Console** 標籤

**預期看到的日誌**：
```
[Gateway] 🚀 Service Worker 已加載
[Gateway] 啟動動態技能加載器...
[Gateway] 讀取技能清單: chrome-extension://...
[Gateway] 發現技能: open_tab, summarize_this_page, who_are_you, close_this_page
[Gateway] ✅ 技能 [open_tab] 已加載
[Gateway] 可用技能:(4) ['open_tab', 'summarize_this_page', 'who_are_you', 'close_this_page']
```

### 查看 SidePanel 日誌

1. 打開 SidePanel（點擊 Jarvis 圖標）
2. 在 SidePanel 上點擊滑鼠右鍵 → \"檢查\"
3. DevTools 會打開，查看 **Console** 標籤

**預期看到的日誌**：
```
[SidePanel] 收到訊息: ask_ai
[SidePanel] 用戶輸入: open Google
[SidePanel] 發送的訊息: {action: "ask_ai", prompt: "open Google", config: {...}}
[SidePanel] 收到回應: {status: "success", text: "..."}
[SidePanel] 執行技能: open_tab
[SidePanel] 技能執行成功: ✅ 成功開啟分頁：https://google.com
```

### 查看特定技能的日誌

每個技能都使用自己的日誌前缀，方便定位問題：

```
[Gateway] - Service Worker 層
[SidePanel] - SidePanel 主線程
[Open Tab Skill] - open_tab 技能
[Summary Page Skill] - summarize_this_page 技能
[Close Page Skill] - close_this_page 技能
[Who Are You Skill] - who_are_you 技能
```

### 常見問題排查

#### 問題：技能未被註冊

**症狀**：Service Worker 日誌中沒有看到新技能

**排查步驟**：
1. ✅ 檢查 `skills/skills-manifest.json` 是否包含該技能
2. ✅ 檢查資料夾名稱是否正確
3. ✅ 檢查 .md 和 .js 檔案是否存在
4. ✅ 重新載入擴展 (`chrome://extensions/` → 刷新)

#### 問題：技能執行失敗

**症狀**：SidePanel Console 顯示 \"技能執行失敗\"

**排查步驟**：
1. ✅ 查看完整的錯誤訊息
2. ✅ 檢查 SidePanel Console 中的詳細日誌
3. ✅ 驗證 `export async function skillname(args)` 的簽名
4. ✅ 檢查函數名是否與檔案名完全相同
5. ✅ 驗證所有必要的 `args` 參數是否存在

#### 問題：AI 沒有調用正確的技能

**症狀**：輸入指令後，AI 呼叫了錯誤的技能或返回錯誤

**排查步驟**：
1. ✅ 查看 Service Worker 日誌中的 AI 回應 JSON
2. ✅ 檢查 `.md` 文件中的規則是否清晰
3. ✅ 嘗試更明確的指令
4. ✅ 檢查當前選擇的 AI 模型是否正常

---

## 📊 項目狀態 (Project Status)

### 核心功能 ✅

- ✅ Gateway-Client 微服務架構
- ✅ Service Worker 路由層
- ✅ SidePanel 執行引擎
- ✅ 動態技能加載系統
- ✅ Gemini 2.5 Flash API 整合
- ✅ Ollama 本地模型支持
- ✅ Chrome.storage.sync 配置持久化

### 已實現的技能 ✅

- ✅ **open_tab** - 打開新標籤頁
- ✅ **summarize_this_page** - 分析並總結頁面
- ✅ **close_this_page** - 關閉當前標籤頁
- ✅ **who_are_you** - 介紹助手功能

### 國際化 (i18n) ✅

- ✅ 12 種語言完全支持
- ✅ 自動語言檢測
- ✅ 手動語言選擇
- ✅ 所有 UI 字符串國際化
- ✅ 通知訊息國際化

### 用戶設置 ✅

- ✅ AI 模型選擇（Gemini / Ollama）
- ✅ 語言設置
- ✅ 通知開關
- ✅ 設置持久化 (chrome.storage.sync)
- ✅ 模型與語言信息傳遞給技能

### 開發工具 ✅

- ✅ 詳細的控制台日誌系統
- ✅ 技能清單管理
- ✅ 可擴展的技能框架
- ✅ Git 分支工作流程 (feat/new-skills)

### 文檔 ✅

- ✅ 完整的 README.md
- ✅ 技能開發指南
- ✅ 調試方法文檔
- ✅ Gateway-Client 架構說明

---

## 🚀 快速開始 (Quick Start)

### 1. 安裝擴展

1. 打開 `chrome://extensions/`
2. 啟用 "開發者模式" (右上角切換)
3. 點擊 "載入已解壓的擴展程式"
4. 選擇本項目的資料夾

### 2. 配置 API

**如果使用 Gemini：**
1. 訪問 [Google AI Studio](https://aistudio.google.com/app/apikeys)
2. 創建 API Key
3. 在 OmniAssistant 選項頁面配置 (需要實現)

**如果使用 Ollama：**
1. 安裝 Ollama: https://ollama.ai
2. 拉取模型: `ollama pull gemma2:2b`
3. 啟動服務: `ollama serve`

### 3. 開始使用

1. 點擊 Chrome 工具欄上的 Jarvis 圖標
2. 在 SidePanel 中輸入指令
3. 例如："open Google", "分析這個頁面", "關閉頁面"

---

## 💻 開發環境設置 (Development Environment)

### 必要工具

- Node.js 14+ (或任何支持 npm 的版本)
- Git
- Chrome 瀏覽器

### 第 1 步：克隆並設置項目

```bash
# 克隆項目
git clone https://github.com/jaylooloomi/chrome-jarvis.git
cd chrome-jarvis

# 安裝依賴並設置 Git hooks
npm install
```

**第一次設置時會發生什麼：**
1. npm 安裝 husky 和其他開發依賴
2. `prepare` 腳本自動運行
3. Husky 設置 Git pre-commit hook
4. 自動生成 `skills/skills-manifest.json`

### 第 2 步：了解項目結構

```
chrome-jarvis/
├── package.json              # npm 配置和腳本
├── scripts/
│   └── generate-manifest.js  # 自動生成技能清單
├── .husky/
│   └── pre-commit            # Git 提交前自動運行
├── skills/
│   ├── skills-manifest.json  # 自動生成（勿手動編輯）
│   ├── open_tab/
│   ├── summarize_this_page/
│   ├── close_this_page/
│   └── who_are_you/
├── service-worker.js
├── sidepanel.js
└── README.md
```

### 第 3 步：在 Chrome 中加載項目

1. 打開 `chrome://extensions/`
2. 啟用"開發者模式"
3. 點擊"載入已解壓的擴展程式"
4. 選擇 `chrome-jarvis` 資料夾

---

## 📦 npm 腳本 (npm Scripts)

### 生成技能清單

```bash
# 手動生成 skills-manifest.json
npm run generate-manifest
```

**什麼時候需要手動運行？**
- 完全移除 node_modules 後
- 手動修改了技能文件後
- 需要驗證技能是否正確註冊時

**何時自動運行？**
- ✅ `npm install` 時自動運行
- ✅ Git commit 時自動運行（pre-commit hook）

### 查看所有可用腳本

```bash
npm run
```

---

## 🔄 開發工作流程 (Development Workflow)

### 自動清單生成 (Auto-Manifest Generation)

該項目使用 **Git pre-commit hook** 自動生成技能清單，這意味著：

1. ✅ 開發者只需關注技能實現
2. ✅ 提交代碼時自動掃描 `skills/` 目錄
3. ✅ 自動生成 `skills/skills-manifest.json`
4. ✅ 自動添加到提交中
5. ✅ **無需手動維護清單！**

### 常見場景

#### 添加新技能

1. **在 `skills/` 下創建新資料夾**
   ```bash
   mkdir skills/my-new-skill
   ```

2. **創建 `.md` 文件**
   ```bash
   touch skills/my-new-skill/my-new-skill.md
   ```
   編輯內容（參考《開發指南》部分）

3. **創建 `.js` 文件**
   ```bash
   touch skills/my-new-skill/my-new-skill.js
   ```
   編輯實現代碼（參考《開發指南》部分）

4. **提交代碼**
   ```bash
   git add skills/my-new-skill/
   git commit -m "feat: add my-new-skill"
   ```
   **自動發生：**
   - ✅ pre-commit hook 觸發
   - ✅ 自動掃描 `skills/` 目錄
   - ✅ 生成 `skills/skills-manifest.json`
   - ✅ 自動添加到提交

5. **推送到遠程**
   ```bash
   git push origin feature-branch
   ```

#### 修改現有技能

```bash
# 編輯文件
vim skills/open_tab/open_tab.md
vim skills/open_tab/open_tab.js

# 測試（在 Chrome 中）
# 1. 打開 chrome://extensions/
# 2. 點擊 OmniAssistant 旁的"刷新"

# 提交（manifest 自動更新）
git add skills/open_tab/
git commit -m "fix: improve open_tab skill"
git push
```

#### 調試技能

1. **查看 Service Worker 日誌**
   ```
   chrome://extensions/
   → OmniAssistant 下方
   → 點擊"Service Worker"文字
   → DevTools 會打開
   ```

2. **查看 SidePanel 日誌**
   ```
   在 SidePanel 上右鍵
   → 檢查
   → 查看 Console 標籤
   ```

3. **重新加載擴展**
   ```
   chrome://extensions/
   → OmniAssistant 旁
   → 點擊"刷新"圖標
   ```

### Git 工作流程

```bash
# 創建功能分支
git checkout -b feat/new-feature

# 進行開發
# ...編輯文件...

# 提交（manifest 自動更新）
git add .
git commit -m "feat: add new feature"
# Pre-commit hook 自動運行：
# - npm run generate-manifest
# - 更新 skills-manifest.json
# - 添加到提交

# 推送
git push origin feat/new-feature

# 創建 Pull Request
# ...在 GitHub 上操作...
```

---

## 🛠️ npm 與 Husky 故障排除

### 問題：manifest 沒有自動更新

**症狀：**
- 添加新技能後，`skills-manifest.json` 沒有更新
- 或者見到 hook 運行但 manifest 沒變

**解決方案：**
```bash
# 手動運行生成腳本
npm run generate-manifest

# 查看輸出確認技能是否被正確發現
```

**檢查清單：**
1. ✅ 技能資料夾名稱正確（如 `open_tab`）
2. ✅ 文件名正確（如 `open_tab.md` 和 `open_tab.js`）
3. ✅ 文件確實存在
4. ✅ 沒有拼寫錯誤

### 問題：Git hook 未運行

**症狀：**
- 提交代碼時 manifest 沒有自動更新
- 沒有看到 "🔄 Checking skills manifest..." 消息

**解決方案：**
```bash
# 確保 husky 已正確安裝
npm install

# 檢查 git hook 是否存在
ls -la .git/hooks/pre-commit

# 如果不存在，手動安裝
npx husky install
```

### 問題：npm install 失敗

**症狀：**
```
npm ERR! Cannot find module 'husky'
```

**解決方案：**
```bash
# 清除 npm 緩存
npm cache clean --force

# 重新安裝
rm -rf node_modules package-lock.json
npm install
```

### 問題：Windows 上 pre-commit hook 不工作

**原因：** Windows 使用不同的行終止符

**解決方案：**
```bash
# 設置 Git 忽略行終止符差異
git config core.safecrlf false

# 重新安裝 husky
npx husky install
```

---

## 📚 進階主題 (Advanced Topics)

### 如何貢獻新技能

1. 按照《開發工作流程》部分添加新技能
2. 確保技能遵循《開發指南》中的規範
3. 測試所有功能
4. 提交 PR

### 如何自定義 AI 模型

編輯 `config.json` 修改：
- `activeModel` - 選擇 "gemini" 或 "ollama"
- 各模型的參數 (temperature, maxTokens 等)

### 如何添加新語言

1. 編輯 `i18n/locales.json`
2. 添加新的語言代碼和翻譯
3. 在 options.html 中添加語言選項

### 更多關於 Husky

了解更多 Git hooks 和 husky：
- [Husky 官方文檔](https://typicode.github.io/husky/)
- [Git Hooks 官方文檔](https://git-scm.com/docs/githooks)

---

## 📜 許可證 (License)

本項目採用 **MIT License + Commons Clause** 的組合許可證。

### ✅ 你可以：
- 自由使用、修改、分發本軟件（非商業用途）
- 個人學習、研究、內部業務使用
- 提交 PR 改進項目
- 在開源項目中使用（保持相同許可證）

### ❌ 你不能：
- 未經授權，將本軟件或衍生產品作為商業服務銷售
- 提供 SaaS、雲服務、託管服務等商業化產品
- 將本軟件的功能打包成付費服務

### 💼 商業使用或其他許可需求

如果你希望將本軟件用於商業目的（包括但不限於 SaaS、商業服務、付費插件等），
請聯繫作者獲取商業許可。

**聯繫方式**：
- GitHub Issues
- 在 README 頂部尋找聯繫信息

詳見完整的 [LICENSE](./LICENSE) 文件。