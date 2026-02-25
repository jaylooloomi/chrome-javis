📝 Project Specification: OmniAssistant (Cloud-Native Edition) v3.0
1. 核心願景 (Project Vision)
打造一個基於 Chrome Extension (Manifest V3) 的極速 AI 代理人。 捨棄本地模型（Nano/Ollama）的硬體限制與維護成本，全面採用 Google Gemini 2.0 Flash API。利用其低延遲、高吞吐的特性，實現即時的意圖解析與網頁操作。
2. 系統架構 (System Architecture)
採用 "Gateway-Client" 模式。Service Worker 是唯一的「邏輯中樞」，負責對接雲端大腦與本地手腳。
2.1 核心組件 (Core Components)
組件
技術實作
職責
Gateway (The Brain)
service-worker.js
中樞控制器。負責狀態管理、API Key 管理、封裝 HTTP 請求 (Call Gemini Flash)、以及最關鍵的 Skill 調度 (Dispatcher)。
Skill Loader
service-worker.js
技能加載器。插件啟動時，負責讀取 /skills 資料夾中的定義檔 (.md)，動態組裝成 System Prompt。
Senses (The Ear)
offscreen.html
聽覺模組 (Phase 2)。繞過 MV3 限制，在背景持續監聽麥克風，將語音轉文字 (STT) 傳給 Gateway。
Executors (The Hand)
content_script.js
執行模組。注入於目標網頁，負責實際的 DOM 操作（如抓取文字、點擊按鈕）。
2.2 AI 引擎 (AI Engine) - Single Source
Model: gemini-2.0-flash (Google AI Studio API)
配置: 使用者需在 options.html 填入 API Key。
溝通協議: 純 HTTP REST API (Post Request)。
輸出格式: Strict JSON (強制模型只回傳 JSON 格式以便程式解析)。

--------------------------------------------------------------------------------
3. 運作流程詳解 (Operational Flow)
這是您最關心的部分：從「載入技能」到「執行動作」的完整生命週期。
階段 A：啟動與技能裝載 (Initialization & Loading)
當瀏覽器啟動或插件重整時，service-worker.js 會執行初始化：
掃描註冊表: 讀取程式碼中預定義的 SKILL_REGISTRY (包含 open_tab, summarize_page)。
讀取說明書: Gateway 使用 fetch 讀取每個技能的 .md 檔案 (例如 skills/opentab/open_tab.md)。
構建大腦 (Prompt Engineering): Gateway 將所有 .md 內容拼接成一個巨大的 System Prompt：
就緒: 此時 dynamicSystemPrompt 變數已建立完成，等待指令。
階段 B：接收指令與思考 (Input & Reasoning)
當使用者在 SidePanel 輸入「幫我開 Google」：
訊息傳遞: UI 發送訊息 { action: "ask_ai", prompt: "幫我開 Google" } 給 Gateway。
呼叫雲端: Gateway 將 System Prompt + User Input 包裝成 API 請求，發送給 Gemini 2.0 Flash。
AI 推理:
Flash 讀取 Prompt，理解用戶意圖是「開啟網頁」。
Flash 查閱技能列表，發現 open_tab 符合需求。
Flash 提取參數 url: "https://www.google.com"。
回傳指令: Flash 回傳純文字 JSON 字串：
階段 C：調度與執行 (Dispatch & Execution)
Gateway 收到 AI 的回應後：
解析 (Parsing): 使用 JSON.parse() 將字串轉為物件。
路由 (Routing): 讀取物件中的 skill 欄位 ("open_tab")。
查找 (Lookup): 在 SKILL_REGISTRY 中找到對應的模組物件。
執行 (Invocation):
Gateway 呼叫該模組的 run(args) 函式。
如果是 open_tab.js: 直接呼叫 chrome.tabs.create。
如果是 summarize_page.js: Gateway 會動態注入腳本到當前分頁，抓取 DOM 文字，甚至可能發起第二次 Gemini Flash 請求來進行總結。
回饋 (Feedback): 技能執行完畢，回傳結果字串（如「已開啟 Google」），Gateway 將其顯示在 UI 上。

--------------------------------------------------------------------------------
4. 技能系統規格 (Skill System Spec)
為了確保擴充性，每個技能必須嚴格遵守以下結構：
4.1 檔案結構
skills/<skill_name>/<skill_name>.md: 介面定義檔 (Interface)。給 AI 看的。
skills/<skill_name>/<skill_name>.js: 實作檔 (Implementation)。給瀏覽器跑的。
4.2 介面定義 (.md)
必須包含 name (對應 JSON 的 skill 欄位) 與 description (幫助 AI 決策)。
name: open_tab
description: Open a specific URL in a new tab.
args:
  - url: (string) The full URL to open.
4.3 實作規範 (.js)
必須 export 一個 async run 函式，並接收一個 args 物件。
export async function run(args) {
    // 實作邏輯...
    return "執行結果訊息";
}

--------------------------------------------------------------------------------
5. 開發階段 (Development Phases)
Phase 1 (目前進度):
[x] 移除 Nano/Ollama 相關代碼。
[x] 實作 service-worker.js 的 loadSkills (靜態匯入)。