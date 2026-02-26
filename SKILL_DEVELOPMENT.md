# Skill 開發指南

> 本文檔說明如何在 Chrome Jarvis 中創建新的 Skill。統一的執行架構確保所有 Skill 都能正確運行。

---

## 目錄

1. [統一執行模型](#統一執行模型)
2. [Skill 類型](#skill-類型)
3. [創建新 Skill 的步驟](#創建新-skill-的步驟)
4. [Args 和 TabId 處理](#args-和-tabid-處理)
5. [代碼示例](#代碼示例)
6. [最佳實踐](#最佳實踐)
7. [常見陷阱](#常見陷阱)

---

## 統一執行模型

所有 Skill 都遵循**統一的路由模式**：

```
用戶輸入
  ↓
Service Worker (AI 路由，自動獲取 tabId)
  ↓
轉發給 SidePanel (帶上 runInPageContext 標志和 tabId)
  ↓
SidePanel 根據 runInPageContext 標志分支執行：
  ├─ true  → chrome.scripting.executeScript() 注入到網頁前端執行
  └─ false → 直接在 SidePanel 中執行
```

### 關鍵優勢

- ✅ **統一入口** - 所有 Skill 的路由邏輯集中在 SidePanel
- ✅ **自動參數注入** - Service Worker 自動注入 tabId 和 url
- ✅ **低開發門檻** - 開發者只需關注 Skill 邏輯，不需要處理路由
- ✅ **易於擴展** - 將來新增執行位置（如 Worker、Frame 等）只需改一個地方

---

## Skill 類型

### 類型 1：網頁前端執行 (`runInPageContext: true`)

**執行位置**：用戶瀏覽的網頁內

**可用 API**：
- ✅ Web API：`window.scrollBy()`, `window.history`, `document.*` 等
- ❌ Chrome Extension API：`chrome.tabs`, `chrome.windows` 等（無法使用）

**何時使用**：
- 操作網頁的 DOM（滾動、點擊、填表等）
- 讀取網頁內容
- 修改網頁行為

**已有示例**：
- `page_scroll` - 滾動頁面
- `page_control` - 瀏覽歷史（上一頁/下一頁）

---

### 類型 2：SidePanel 執行 (`runInPageContext: false`)

**執行位置**：SidePanel（擴展面板）

**可用 API**：
- ✅ Chrome Extension API：`chrome.tabs.*`, `chrome.windows.*`, `chrome.scripting.*` 等
- ✅ Web API：所有網頁能用的 API
- ❌ 無法直接操作網頁 DOM（需要通過注入腳本）

**何時使用**：
- 需要使用 Chrome Extension API（操作標籤頁、窗口等）
- 與系統交互（通知、存儲等）
- 複雜的業務邏輯（調用外部 API、文件處理等）

**已有示例**：
- `open_tab` - 打開新標籤頁
- `close_this_page` - 關閉標籤頁
- `summarize_this_page` - 提取頁面內容並發送到 Gemini
- `who_are_you` - 返回身份信息

---

## 創建新 Skill 的步驟

### 第 1 步：決定執行位置

根據 Skill 需要的 API 決定 `runInPageContext` 值：

| Skill 需求 | runInPageContext | 原因 |
|-----------|--------|------|
| 需要 `chrome.tabs` / `chrome.windows` | false | 這些 API 只在 Service Worker/SidePanel 可用 |
| 需要操作網頁 DOM | true | 需要在網頁前端執行 |
| 混合（既需要 Extension API 又需要操作 DOM） | false | 在 SidePanel 中使用 `chrome.scripting.executeScript` 來操作 DOM |

### 第 2 步：創建文件夾結構

```
skills/
  your_skill_name/
    your_skill_name.md      # 技能定義和示例
    your_skill_name.js      # 技能實現
```

### 第 3 步：編寫 `your_skill_name.md`

定義 Skill 的 AI 指令和參數。格式如下：

```markdown
# your_skill_name

## 功能描述
說明 Skill 的功能。

## 參數
描述 Skill 接收的參數。

### 示例

**正確用法：**
- 例子 1 ✓
- 例子 2 ✓

**不使用此技能的情況：**
- 反面例子 1 ✗
- 反面例子 2 ✗

## Intent 映射

說明 AI 如何識別用戶的意圖並調用此 Skill。

## 實現細節

- runInPageContext: true/false
- 需要的 API：列出使用的 API
- 使用的參數：tabId, url, 等
```

### 第 4 步：編寫 `your_skill_name.js`

導出一個異步函數，函數名必須與文件名相同：

```javascript
export async function your_skill_name(args) {
    console.log("[Your Skill] 啟動，接收到參數:", args);
    
    try {
        // 你的 Skill 邏輯
        const result = await doSomething(args);
        return result;
    } catch (error) {
        console.error("[Your Skill] 錯誤:", error);
        throw new Error(`Skill 失敗：${error.message}`);
    }
}
```

### 第 5 步：更新 Skill 配置

編輯 `skills/skills-manifest.json`，**不需要手動編輯**。Pre-commit hook 會自動掃描並生成。

運行 `git add .` 時，hook 會自動：
- ✅ 掃描 `skills/` 文件夾
- ✅ 發現新的 Skill
- ✅ 生成/更新 `skills-manifest.json`

---

## Args 和 TabId 處理

### 自動注入的參數

Service Worker 會**自動**在 args 中注入以下參數（如果 Skill 有定義）：

| 參數 | 值 | 說明 |
|-----|-----|------|
| `tabId` | 數字 | 當前活跃標籤頁的 ID |
| `url` | 字符串 | 當前活跃標籤頁的 URL |
| `modelName` | 字符串 | 當前使用的 AI 模型名稱 |
| `language` | 字符串 | 當前麥克風語言（如 "zh-TW"） |

### 占位符替換

AI 在 Skill 定義中可以使用占位符：

```json
{
    "tabId": "ACTIVE_TAB",
    "url": "ACTIVE_TAB_URL"
}
```

Service Worker 會**自動替換**這些占位符為實際值：
- `"ACTIVE_TAB"` → 當前標籤頁 ID（數字）
- `"ACTIVE_TAB_URL"` → 當前標籤頁 URL（字符串）

### 如何在 Skill 中使用 Args

```javascript
export async function my_skill(args) {
    const tabId = args.tabId;        // 當前標籤頁 ID（自動注入）
    const url = args.url;            // 當前標籤頁 URL（自動注入）
    const customParam = args.param1; // AI 從用戶輸入解析出的參數
    
    // 使用這些參數
}
```

---

## 代碼示例

### 示例 1：網頁前端 Skill（runInPageContext: true）

**場景**：創建一個能夠改變網頁背景顏色的 Skill

**文件：`skills/change_bg_color/change_bg_color.md`**

```markdown
# change_bg_color

## 功能
改變當前網頁的背景顏色。

## 參數
- color: 顏色名稱或 hex 代碼（例："red", "#FF0000"）

## 示例

**正確用法：**
- "改變背景為紅色" ✓
- "把背景改成藍色" ✓
- "背景顏色改為 #FFD700" ✓

**不使用此技能的情況：**
- "改變瀏覽器背景" ✗（應該是網頁背景，不是瀏覽器）
- "改變按鈕顏色" ✗（太具體，超出范圍）

## Intent 映射
- 用戶說 "改變背景為 [顏色]" → 調用 change_bg_color，color = [顏色]

## 實現細節
- runInPageContext: true
- 使用 `document.body.style.backgroundColor`
```

**文件：`skills/change_bg_color/change_bg_color.js`**

```javascript
export async function change_bg_color(args) {
    console.log("[Change BG Color] 啟動:", args);
    
    try {
        const color = args.color;
        
        if (!color) {
            throw new Error("未提供顏色參數");
        }
        
        // 修改網頁背景
        document.body.style.backgroundColor = color;
        
        console.log("[Change BG Color] 成功改變背景為:", color);
        return `✅ 背景已改為 ${color}`;
        
    } catch (error) {
        console.error("[Change BG Color] 錯誤:", error);
        throw new Error(`改變背景失敗：${error.message}`);
    }
}
```

---

### 示例 2：SidePanel Skill（runInPageContext: false）

**場景**：創建一個能夠提取網頁標題並複製到剪貼板的 Skill

**文件：`skills/copy_page_title/copy_page_title.md`**

```markdown
# copy_page_title

## 功能
複製當前網頁的標題到剪貼板。

## 參數
- 無（自動使用 tabId 和 url）

## 示例

**正確用法：**
- "複製頁面標題" ✓
- "把標題複製到剪貼板" ✓

**不使用此技能的情況：**
- "複製頁面內容" ✗（應該是標題，不是整個內容）

## Intent 映射
- 用戶說 "複製頁面標題" → 調用 copy_page_title

## 實現細節
- runInPageContext: false
- 需要 tabId 和 url（自動注入）
- 使用 chrome.tabs.get() 獲取標題
- 使用 navigator.clipboard 複製到剪貼板
```

**文件：`skills/copy_page_title/copy_page_title.js`**

```javascript
export async function copy_page_title(args) {
    console.log("[Copy Page Title] 啟動:", args);
    
    try {
        const tabId = args.tabId;
        
        if (!tabId) {
            throw new Error("無法獲取當前標籤頁");
        }
        
        // 獲取標籤頁信息（包括標題）
        const tab = await chrome.tabs.get(tabId);
        const title = tab.title;
        
        console.log("[Copy Page Title] 獲取標題:", title);
        
        // 複製到剪貼板
        await navigator.clipboard.writeText(title);
        
        console.log("[Copy Page Title] 成功複製");
        return `✅ 已複製標題：${title}`;
        
    } catch (error) {
        console.error("[Copy Page Title] 錯誤:", error);
        throw new Error(`複製標題失敗：${error.message}`);
    }
}
```

---

## 最佳實踐

### 1. 日誌記錄

始終在 Skill 開始、關鍵步驟和錯誤時輸出日誌：

```javascript
console.log("[Skill Name] 啟動，接收到參數:", args);
console.log("[Skill Name] 正在執行 X 操作");
console.error("[Skill Name] 錯誤:", error);
```

### 2. 錯誤處理

總是使用 try-catch，並拋出有意義的錯誤信息：

```javascript
try {
    // Skill 邏輯
} catch (error) {
    console.error("[Skill Name] 錯誤:", error);
    throw new Error(`Skill 失敗：${error.message}`);
}
```

### 3. 返回值

返回對用戶友好的信息：

```javascript
// ✅ 好
return `✅ 成功滾動 500 像素`;

// ❌ 不好
return "done";
```

### 4. 參數驗證

始終驗證必要的參數：

```javascript
export async function my_skill(args) {
    const param = args.param;
    
    if (!param) {
        throw new Error("未提供必要參數：param");
    }
}
```

### 5. 文檔完整性

確保 `.md` 文件包含：
- ✅ 清晰的功能描述
- ✅ 參數列表和類型
- ✅ 正確/錯誤的使用示例
- ✅ Intent 映射規則
- ✅ runInPageContext 標志

---

## 常見陷阱

### ❌ 陷阱 1：忘記導出函數

```javascript
// ❌ 錯誤 - 沒有 export
async function my_skill(args) {
    // ...
}

// ✅ 正確
export async function my_skill(args) {
    // ...
}
```

### ❌ 陷阱 2：函數名不匹配文件名

```javascript
// 文件：my_skill.js
// ❌ 錯誤 - 函數名應該是 my_skill
export async function mySkill(args) {
    // ...
}

// ✅ 正確
export async function my_skill(args) {
    // ...
}
```

### ❌ 陷阱 3：使用了不可用的 API

```javascript
// ❌ 錯誤 - 在網頁前端 Skill 中使用 Chrome API
export async function my_skill(args) {
    // runInPageContext: true
    const tab = await chrome.tabs.get(args.tabId); // ❌ 會報錯
}

// ✅ 正確 - 改為 runInPageContext: false
export async function my_skill(args) {
    const tab = await chrome.tabs.get(args.tabId); // ✅ 成功
}
```

### ❌ 陷阱 4：不處理占位符

```javascript
// ❌ 錯誤 - 期望 tabId 是數字，但可能收到 "ACTIVE_TAB"
export async function my_skill(args) {
    const tabId = args.tabId; // 可能是 "ACTIVE_TAB"
    await chrome.tabs.remove(tabId); // ❌ 會報錯
}

// ✅ 正確 - Service Worker 自動替換占位符
// 不需要在 Skill 中處理，Service Worker 會自動替換
// 只需確保在 .md 中定義了參數
```

### ❌ 陷阱 5：沒有提供有意義的錯誤信息

```javascript
// ❌ 錯誤
throw new Error("Error"); // 用戶看不懂

// ✅ 正確
throw new Error(`關閉標籤頁失敗：找不到 ID 為 ${tabId} 的標籤頁`);
```

### ❌ 陷阱 6：不考慮網頁 DOM 隔離

```javascript
// ❌ 錯誤 - 在 SidePanel 中無法直接修改網頁 DOM
export async function my_skill(args) {
    // runInPageContext: false
    document.body.style.backgroundColor = "red"; // ❌ 修改的是 SidePanel 的背景，不是網頁
}

// ✅ 正確 - 改為在網頁前端執行，或在 SidePanel 中注入腳本
export async function my_skill(args) {
    // runInPageContext: true
    document.body.style.backgroundColor = "red"; // ✅ 修改網頁背景
}
```

---

## 快速檢查清單

創建新 Skill 時，檢查以下項目：

- [ ] 決定了 `runInPageContext` 值
- [ ] 創建了 `skills/skill_name/` 文件夾
- [ ] 編寫了 `skill_name.md` 文件
  - [ ] 功能描述清晰
  - [ ] 參數列表完整
  - [ ] 包含正確和錯誤示例
  - [ ] Intent 映射規則清楚
- [ ] 編寫了 `skill_name.js` 文件
  - [ ] 函數名與文件名匹配
  - [ ] 添加了 `export async function`
  - [ ] 包含 try-catch 錯誤處理
  - [ ] 輸出了必要的日誌
  - [ ] 驗證了必要參數
  - [ ] 只使用了可用的 API
- [ ] 測試了 Skill 的執行
  - [ ] 說出觸發 Skill 的命令
  - [ ] 檢查控制台日誌確認執行路徑正確
  - [ ] 驗證了返回值和行為

---

## 相關文件

- [service-worker.js](./service-worker.js) - 統一路由邏輯
- [sidepanel.js](./sidepanel.js) - Skill 執行分支邏輯
- [skills/skills-manifest.json](./skills/skills-manifest.json) - Skill 清單（自動生成）
- [skills/](./skills/) - Skill 實現文件夾

---

## 更新日誌

- **2026-02-26** - 統一執行架構實現，發布此開發指南
