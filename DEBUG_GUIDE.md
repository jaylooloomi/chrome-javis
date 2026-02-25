# 調試指南

## 問題診斷流程

### 1. Service Worker 日誌查看

1. 打開 `chrome://extensions/`
2. 找到 "OmniAssistant"
3. 點擊 "Service Worker" 下的文字（不是開關）
4. 查看 DevTools 控制台

**預期日誌序列（總結功能）**：
```
[Service Worker] 收到訊息: summarize_content
[Service Worker] 處理 summarize_content
[Service Worker] 開始總結，內容長度: 2345
[AI] 嘗試使用 Gemini API
[AI] Gemini API 回應狀態: 200
[AI] Gemini API 成功取得回應
[Service Worker] 總結完成
```

**預期日誌序列（開啟分頁功能）**：
```
[Service Worker] 收到訊息: parse_url
[Service Worker] 處理 parse_url
[Service Worker] 開始解析 URL: youtube
[AI] 嘗試使用 Gemini API
[AI] Gemini API 回應狀態: 200
[AI] Gemini API 成功取得回應
[Service Worker] URL 解析完成: https://www.youtube.com
```

### 2. 內容腳本日誌查看

在網頁上打開 DevTools，查看控制台：

**總結功能日誌**：
```
[Summarize Skill] 發送總結請求
[Summarize Skill] 收到回應: {status: "success", text: "..."}
```

**開啟分頁功能日誌**：
```
[Open Tab Skill] 發送 URL 解析請求
[Open Tab Skill] 收到回應: {status: "success", text: "https://www.youtube.com"}
```

### 3. Gemini API 問題診斷

#### 問題：看到 `[AI] Gemini API 回應狀態: 400` 或 `401`

**原因**：
- API Key 無效或過期
- 請求格式不正確

**解決方案**：
1. 檢查您的 Gemini API Key 是否正確
2. 從 [Google AI Studio](https://aistudio.google.com) 獲取新的 API Key
3. 確保 API Key 有足夠的配額

#### 問題：看到 `[AI] 嘗試使用 Gemini Nano`

**原因**：
- Gemini API Key 為空或提供失敗
- 或 Gemini API 不可用

**解決方案**：
1. 確保您在側邊欄輸入了 API Key
2. 檢查 API Key 是否被正確傳遞
3. 嘗試用 `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=YOUR_API_KEY` 手動測試

#### 問題：看到 `[AI] 嘗試使用 Ollama`

**原因**：
- Gemini API 不可用
- Gemini Nano 不支援

**解決方案**：
1. 確保 Ollama 運行在 `http://localhost:11434`
2. 確保已安裝 `gemma2:2b` 模型
3. 運行 `ollama run gemma2:2b` 測試

### 4. 訊息傳遞失敗診斷

#### 問題：`Could not establish connection. Receiving end does not exist.`

**可能原因**：
- Service Worker 未正確初始化
- 訊息監聽器未被註冊
- Chrome 版本太舊

**調試步驟**：
1. 查看 Service Worker 日誌是否出現任何初始化訊息
2. 檢查 Background 日誌：`[Background] 擴充功能已安裝`
3. 嘗試重新載入擴充功能
4. 升級到最新的 Chrome 版本

### 5. 完整的調試清單

- [ ] 確認 Service Worker 已載入 (查看 `chrome://extensions/`)
- [ ] 確認 Gemini API Key 已正確輸入到側邊欄
- [ ] 查看 Service Worker 控制台是否有 `[Service Worker] 收到訊息` 日誌
- [ ] 查看 AI 層日誌是否顯示 API 選擇
- [ ] 驗證 Gemini API 狀態碼
- [ ] 檢查錯誤訊息的具體內容

## 常見解決方案

### 重新載入擴充功能

1. 打開 `chrome://extensions/`
2. 找到 "OmniAssistant"
3. 點擊左下角的重新整理圖示

### 清除快取

1. 打開 `chrome://extensions/`
2. 找到 "OmniAssistant"
3. 點擊「詳細資料」
4. 點擊「清除資料」

### 取得新的 Gemini API Key

1. 訪問 [Google AI Studio](https://aistudio.google.com)
2. 點擊「取得 API Key」
3. 複製新的 API Key
4. 在側邊欄貼上 API Key

## 日誌標籤說明

- `[Background]` - 背景腳本日誌
- `[Service Worker]` - Service Worker 日誌
- `[AI]` - AI 呼叫層日誌
- `[Summarize Skill]` - 總結技能日誌
- `[Open Tab Skill]` - 開啟分頁技能日誌
