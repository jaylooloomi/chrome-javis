# Javis 重定義設計 — 會自己長出技能的瀏覽器 AI 助手

> 日期:2026-06-14
> 狀態:已鎖定(由使用者授權自主執行)
> 分支:`feat/redefine-self-teaching-agent`

## 1. 一句話定位

**Javis 是一個會自己長出技能的瀏覽器 AI 助手:你用自然語言教它做一次任務,它讀 DOM 摸索成功後,把過程「固化」成一個具名技能;之後一鍵或排程**零 LLM**重放。**

差異點(對比 alibaba/page-agent 等「每次都即時呼叫 LLM 操作」的方案):LLM 只在「**第一次學會**」與「**自癒**」兩個時點花錢,**日常重放完全免費、快速、結果穩定**。

## 2. 背景與動機

現有專案(原 OmniAssistant / chrome-jarvis)功能發散,混了三條互不相干的線:

1. 瀏覽器操控 agent(固定技能:開分頁、捲動、關頁、下載圖片、摘要…)
2. 會議錄音轉錄 + 會議記錄生成
3. 多模型(Gemini 雲端 + 三種 Ollama)、快取除錯頁

重定義方向:**只保留並深化「瀏覽器 AI 助手」這一條主軸**,並把它從「固定技能分派器」升級為「能讀 DOM、自主操作任意元素、再把成功操作固化成可重放技能」的自學型 agent。

## 3. 範圍決策(Scope)

### 3.1 移除(Cut)
- 會議記錄整塊:`meeting.html`、`meeting.js`、`onepage-meeting.html`、音檔轉錄、會議記錄生成(`handleAudioTranscription`、`handleGenerateMeetingNotes`)。
- 快取除錯頁:`cache-history.html`、`cache-history.js` 及所有 `CACHE_HISTORY_*.md`(由新的「技能庫」UI 取代)。
- service worker 內的 AI 推理快取(`aiResultCache` / `recentCacheList` 整套):舊架構是「快取 AI 挑哪個固定技能」,新架構的「快取」概念由「固化技能」取代,語意完全不同,移除以免混淆。
- 多 Ollama 模型的 `config.json` 列舉式設定。
- 既有 9 個固定技能的「AI 從清單挑一個」分派邏輯(`skills-manifest.json` + 動態 system prompt 拼接)。其中少數仍有價值的**瀏覽器層原語**(開/關/切換分頁、導航)保留為「動作原語」,供 agent 與 replay 共用;其餘移除。

### 3.2 保留並演化(Keep & Evolve)
- Manifest V3 擴充 + Side Panel 主 UI + Options 設定頁。
- i18n 系統(`i18n/`,12 語言)— 低成本資產,保留;新 UI 字串併入。
- API Key 本機加密儲存(`crypto-utils.js`)— 沿用於模型端點金鑰。
- Toast 通知(`toast-notification.js`)。

### 3.3 不做(YAGNI,本期排除)
- 跨瀏覽器(僅 Chrome / Chromium MV3)。
- 雲端同步技能庫(技能存本機 + 可手動匯出/匯入 JSON 即可)。
- 視覺/截圖式操作(走純文字 DOM 路線)。
- 多步驟分支/條件邏輯的視覺化編輯器(技能是線性步驟序列;分支交給 agent 自癒)。

## 4. 模型策略(解決 Ollama vs 大眾的拉扯)

**做成模型無關(model-agnostic):使用者只需填一個 OpenAI 相容端點。**

- 設定欄位:`baseURL`、`model`、`apiKey`(加密儲存)。
- 預設引導使用者用**本地 Ollama**(`http://localhost:11434/v1`,免費、隱私、可離線開發)。
- 想要品質可填任一雲端金鑰(Gemini OpenAI-compat、DeepSeek、Qwen/DashScope…)。
- **開發期**可暫用 page-agent 免金鑰 demo 端點快速跑通(`qwen3.5-plus`),但**產品不得依賴**(僅供評估、資料經第三方/中國伺服器、無 SLA)。設定頁不預設、不主打此端點。
- 重放路徑**完全不呼叫 LLM** → 模型成本只發生在「學習」與「自癒」,單位經濟極佳,作為產品賣點。

## 5. 架構

採**路線 1:站在 page-agent(MIT)上**當「感知 + 操作」引擎,自建「固化 + 技能庫 + 重放 + 自癒」差異化層。

```
┌────────────────────────── Side Panel (主 UI) ──────────────────────────┐
│  ① 對話/指令輸入   ② 技能庫(list / run / rename / delete / export)      │
└────────────────────────────────────────────────────────────────────────┘
        │  使用者下達自然語言任務 / 點擊重放某技能
        ▼
┌──────────────────────────── 核心層(可獨立測試)──────────────────────────┐
│  Learn Engine ── 包裝 page-agent:讀 DOM → 規劃 → 操作 → 觀察(迴圈)     │
│       │  每個成功動作命中一個「活 DOM 節點」                              │
│       ▼                                                                   │
│  Recorder/Freeze ── 把命中節點翻譯成「穩定選擇器束」+ 記成宣告式步驟      │
│       │                                                                   │
│       ▼                                                                   │
│  Selector Engine ── 計算/解析選擇器束(testid>role+name>text>CSS>xpath)  │ ★關鍵
│                                                                           │
│  Skill Store ── chrome.storage CRUD + JSON 匯出/匯入                      │
│                                                                           │
│  Replay Engine ── 零 LLM:解析選擇器 → 等待條件 → 派發動作                │
│       │                                                                   │
│       └─ 失敗 → Self-Heal:回退 Learn Engine 重新定位 → 重新固化           │
└──────────────────────────────────────────────────────────────────────────┘
        │  跨分頁/視窗等擴充層動作
        ▼
┌──────────────── Service Worker(瘦身後)────────────────┐
│  動作原語:開/關/切換分頁、導航;OpenAI 相容 LLM proxy   │
└──────────────────────────────────────────────────────────┘
```

### 5.1 元件職責(各自單一職責、可獨立測試)

| 元件 | 做什麼 | 依賴 | 如何測試 |
|------|--------|------|----------|
| **Selector Engine** | node ⇄ 選擇器束雙向轉換,含 fallback 優先序與去重 | 無(純 DOM) | jsdom 單元測試 |
| **Replay Engine** | 依宣告式步驟 `{action, selectorBundle, value, wait}` 重放,含輪詢式等待 | Selector Engine | jsdom 單元測試 |
| **Skill Store** | 技能 CRUD、版本、參數槽、匯出/匯入 | chrome.storage(可注入 mock) | mock storage 單元測試 |
| **Recorder/Freeze** | 攔截 Learn Engine 每步成功動作 → 產生步驟 | Selector Engine | jsdom + 假動作流 |
| **Learn Engine** | 包裝 page-agent,跑 NL 任務 | page-agent、LLM client | 整合測試(瀏覽器) |
| **Self-Heal** | 選擇器全失敗 → 叫 Learn Engine 重定位 → 重新固化 | Learn + Selector | 整合測試 |

### 5.2 資料模型

**選擇器束(SelectorBundle)** — 一個元素存多個 fallback,依序嘗試:
```json
{
  "candidates": [
    { "type": "testid", "value": "[data-testid='submit']", "score": 100 },
    { "type": "role+name", "value": { "role": "button", "name": "登入" }, "score": 80 },
    { "type": "text", "value": "登入", "score": 60 },
    { "type": "css", "value": "form.login > button.primary", "score": 40 },
    { "type": "xpath", "value": "//form/button[2]", "score": 10 }
  ],
  "tag": "button"
}
```

**技能(Skill)** — 宣告式線性步驟序列,支援具名參數:
```json
{
  "id": "uuid",
  "name": "在 X 網站簽到",
  "description": "...",
  "startUrl": "https://example.com/",
  "params": [{ "name": "keyword", "label": "搜尋關鍵字" }],
  "steps": [
    { "action": "navigate", "value": "{{startUrl}}", "wait": { "type": "load" } },
    { "action": "click", "selector": { /* SelectorBundle */ }, "wait": { "type": "element", "selector": {…} } },
    { "action": "input", "selector": {…}, "value": "{{keyword}}" },
    { "action": "click", "selector": {…} }
  ],
  "createdAt": 0, "updatedAt": 0, "stats": { "runs": 0, "heals": 0 }
}
```
動作集(action):`navigate`、`click`、`input`、`select`、`scroll`、`waitFor`、`openTab`、`closeTab`、`switchTab`。

### 5.3 分層降級執行(replay 的核心策略)

研究顯示純規則自癒成功率低(Healenium ~28%),故採三層:

1. **確定性重放(零 LLM)**:依選擇器束優先序解析元素 → 命中即執行。覆蓋 ~99% 常見情況,快又免費。
2. **LLM 自癒**:某步所有 fallback 都失敗 → 叫 Learn Engine 用該步的自然語言意圖重新定位 → 成功後**重新固化**該步選擇器束 → 繼續。
3. **求助使用者**:自癒也失敗 → 在 Side Panel 顯示卡住的步驟,讓使用者示範或編輯。

每次重放記錄走了哪一層(`stats.heals++`)。**永不靜默截斷**:跳過/降級都顯示在 UI。

### 5.4 為何 in-page 重放是對的
頁內(content script)重放天然沿用使用者既有登入/cookie/session,免去 CDP/headless 的認證搬運;這也契合擴充形態。**絕不把 page-agent 的執行期 highlightIndex 寫進技能** — 固化時必須翻譯成穩定選擇器束。

## 6. 技術基礎建設

現有專案是純 ES module、無打包工具。為整合 page-agent(npm)並寫可測模組,新增:

- **打包**:esbuild(輕量、快,Windows 友善),把 content script / side panel bundle 出來。
- **測試**:Vitest + jsdom 環境(單元測試 Selector / Replay / Store)。
- **npm scripts**:`dev`(watch build)、`build`(production)、`test`、`lint`。
- 保留 husky pre-commit,改為跑 `test` + `lint`(移除舊的 skills-manifest 生成)。

## 7. 安全與上架考量

- 金鑰只存本機(`chrome.storage.local` + crypto-utils 加密),不外傳。
- `host_permissions` 收斂:移除無謂權限;`<all_urls>` 因 agent 需操作任意網站而保留,但在 Web Store 說明頁清楚揭露用途。
- LLM 請求由使用者自填端點直連(或本地 Ollama);不經過我方伺服器。
- 重放在 content script 內執行使用者自己錄製的步驟,行為透明可檢視(技能可展開看每一步)。

## 8. 實作階段(里程碑)

| 階段 | 內容 | 可驗證產出 |
|------|------|-----------|
| **P0** | 清理發散功能 + 建打包/測試基建 + 分支 | repo 乾淨、`npm test` 可跑 |
| **P1** | Selector Engine(node⇄束,fallback) | jsdom 單元測試綠 ★ |
| **P2** | Replay Engine(宣告式步驟 + 等待) | jsdom 單元測試綠 ★ |
| **P3** | Skill Store(CRUD + 匯出/匯入) | mock storage 測試綠 |
| **P4** | Side Panel 技能庫 UI(list/run/delete/export) | 可在擴充內操作技能 |
| **P5** | Recorder/Freeze(攔截動作 → 產生步驟) | 假動作流 → 正確技能 JSON |
| **P6** | 整合 page-agent 當 Learn Engine + 模型設定 | NL 任務能在分頁跑起來 |
| **P7** | Self-Heal 分層降級 | 選擇器失效能自癒並重新固化 |
| **P8** | 參數化技能、排程觸發、i18n、上架打磨 | 可上架候選 |

★ = 可在本環境(node/jsdom)直接執行驗證的部分,優先做、先綠燈。

## 9. 風險

- **page-agent 整合成本**:它偏「頁內函式庫」,MV3 content script 打包與其 API 對接需處理;P6 若阻力大,退路是參考其 DOM 序列化自寫精簡 learn 引擎(路線 2 局部回退)。
- **選擇器穩定性**:整個願景成敗關鍵在 Selector Engine;故列為 P1 第一個做且重測。
- **無瀏覽器自動化測試**:本環境難全自動跑 Chrome;核心邏輯(P1–P3、P5)以 jsdom 單元測試覆蓋,P4/P6/P7 需真機驗證(會明確標示「待真機驗證」而非宣稱已驗證)。
- **真機測試需使用者協助**:可能需要你安裝 Ollama 或提供雲端金鑰來做端到端驗證 — 屆時才會找你。

## 10. 設計修訂紀錄(Decision Log)

### 2026-06-14 — Learn Engine 改為自建精簡迴圈(取代「依賴 page-agent 內部」)

原 §5 規劃「站在 page-agent 上」當感知+操作引擎。實作 P6 時改為**自建一個 page-agent 風格的精簡迴圈**(感知→決策→固化→執行),理由:

1. **固化需要第一級存取「當下命中的活元素」**。要把元素翻成穩定選擇器束,最乾淨的時機是「agent 決定操作某元素的當下」。自建迴圈讓固化 hook 是一等公民;若改為攔截 page-agent 內部執行,需深入其私有實作且脆弱。
2. **學習即重放、保證可重放**。自建迴圈中,執行動作走的是**與重放完全相同的路徑**(recorder 固化出 step → `replayStep` 執行)。因此凡是學會的,必然可重放——這個不變式靠自建迴圈才容易保證。
3. **可測性**。注入式 LLM 讓整個編排能用腳本化模型在 jsdom 中單元測試(已 21 測試),只有「真實模型的決策品質」需要真機。

仍沿用 page-agent 的**設計理念**(MIT、純文字索引化 DOM、index→element),只是不依賴其程式碼。模型端點維持 OpenAI 相容、模型無關(§4 不變),page-agent 免費 demo 端點仍可作為開發期的其中一個可填端點。
