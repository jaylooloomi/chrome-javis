# 🎤 音頻轉錄功能 - 使用指南

## 功能概述

Meeting Assistant 現已支持使用 **Google Generative AI (Gemini)** 進行音頻轉錄，可以將 MP3、WAV、AAC、FLAC、M4A 和 OGG 音檔自動轉錄為文字，並生成逐字稿。

## 支持的音訊格式

✅ **MP3** (.mp3)  
✅ **WAV** (.wav)  
✅ **AAC** (.aac)  
✅ **FLAC** (.flac)  
✅ **M4A** (.m4a)  
✅ **OGG** (.ogg)  

**限制：** 最大檔案大小 25MB（Google Generative AI API 限制）

## 快速開始步驟

### 2️⃣ 第一步：設置 Google API Key

1. 打開 **設定 → 🔑 API 配置**
2. 點擊 **點擊獲取 API Key** 連結
   - 或訪問 https://aistudio.google.com/app/apikey
3. 複製您的 API Key
4. 粘貼到輸入框中
5. 點擊 **💾 保存配置** 按鈕
6. 點擊 **🧪 連接測試** 驗證設置

### 2️⃣ 第二步：使用音檔轉錄

1. 打開 **會議記錄** 標籤頁
2. 在 **🎤 語音和音檔輸入** 部分：
   - 選擇語言（預設：繁體中文）
   - 點擊 **📁 導入音檔** 按鈕
   - 選擇您的音檔
3. 等待轉錄完成
4. 轉錄的文字將出現在「錄音文字內容」框中
5. 選擇提示語並點擊 **🤖 生成會議記錄** 生成最終格式

## 功能特性

### ✨ 核心功能

- **自動逐字稿生成**：自動識別說話者和時間戳記
- **多語言支持**：
  - 繁體中文（預設）
  - 簡體中文
  - English (US)
  - English (UK)  
  - 日本語
  - 한국어

### 🔐 安全性

- API Key 在本機加密存儲，不上傳任何服務器
- 支持任何 Google Generative AI API Key
- 建議設置 API 配額限制以控制成本

### 📊 使用統計

Google Generative AI 定價模型：
- **Gemini 1.5 Flash**：約 $0.075/百萬個輸入token，$0.30/百萬個輸出token
- **Gemini 1.5 Pro**：約 $3.50/百萬個輸入token，$10.50/百萬個輸出token

> 💡 **提示**：使用 1.5 Flash 模型可以節省成本，同時保持良好的轉錄品質。

## 高級用法

### 自訂轉錄提示

在 **自訂提示語 (Prompt)** 部分，您可以：

```
請幫我對這段音訊製作詳細的逐字稿，
並標註說話者（如果有多人）與時間點。
格式請遵循 [時間] 說話者: 內容 的方式。
```

### 與其他功能集成

轉錄的文字可以：
- ✅ 導出為 Markdown 檔案 (**⬇️ 下載 .md 檔案**)
- ✅ 輸出到 Google Docs、Google Keep、Gemini 或 NotebookLM
- ✅ 進一步使用 AI 進行摘要和分析

## 常見問題

### ❓ Q: 如何獲取 Google API Key？

**A:** 
1. 訪問 https://aistudio.google.com/app/apikey
2. 登錄您的 Google 帳戶
3. 點擊 "Create API Key"
4. 複製生成的密鑰

### ❓ Q: 為什麼轉錄失敗？

**A:** 可能的原因：
- ❌ API Key 未正確配置或已過期
- ❌ 音檔損壞或格式不支持
- ❌ 網路連接問題
- ❌ 音檔大小超過 25MB

**解決方案**：
1. 重新檢查 API Key
2. 嘗試 🧪 **連接測試** 按鈕
3. 驗證音檔格式和大小
4. 檢查網路連接

### ❓ Q: 轉錄後可以編輯文字嗎？

**A:** 是的！轉錄後的文字會出現在「錄音文字內容」框中，您可以：
- ✏️ 直接編輯和修正
- 🔄 結合多個音檔的轉錄
- 📝 手動添加額外信息

### ❓ Q: 如何降低成本？

**A:** 
- 使用 **Gemini 1.5 Flash**（更便宜且足夠快）
- 在 Google Cloud Console 設置 API 配額警告
- 定期監控使用情況
- 只轉錄需要的長度音檔

## 故障排除

### 🔧 連接測試失敗

```
症狀：Cannot authenticate with the provided credentials
原因：API Key 無效或已禁用
解決方案：
1. 訪問 https://console.cloud.google.com
2. 驗證 API 服務已啟用
3. 檢查配額和費用設置
4. 創建新的 API Key
```

### ⚠️ 配額限制

如果看到 `RESOURCE_EXHAUSTED` 錯誤：
1. 訪問 Google Cloud Console
2. 檢查您的配額使用情況
3. 考慮升級計畫或等待重置期

### 🌐 CORS/網路問題

如果看到網路錯誤：
- ✅ 確認網路連接穩定
- ✅ 檢查防火牆設置
- ✅ 稍後重試

## 技術詳情

### API 端點

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
```

### 支持的模型

| 模型 | 速度 | 成本 | 推薦用途 |
|------|------|------|---------|
| gemini-2.5-flash | ⚡ 很快 | 💰 便宜 | 日常轉錄 |
| gemini-1.5-pro | 🚀 快 | 💵 中等 | 複雜分析 |
| gemini-2.0-flash | ⚡⚡ 最快 | 💰 便宜 | 最新特性 |

### 請求結構

```json
{
  "contents": [{
    "parts": [
      {
        "text": "請幫我對這段音訊製作詳細的逐字稿..."
      },
      {
        "inlineData": {
          "mimeType": "audio/mpeg",
          "data": "base64_encoded_audio_data"
        }
      }
    ]
  }]
}
```

## 更新歷史

**v1.0.0** (2026-03-05)
- ✨ 初始發佈
- ✅ Google Gemini 音頻轉錄
- ✅ 多語言支持
- ✅ API Key 安全存儲
- ✅ 連接測試功能

## 支持和反饋

如有問題或建議：
- 📧 提交 Issue 到 GitHub
- 💬 加入社區討論
- 🐛 報告 Bug 時請包含：
  - 音檔格式和大小
  - 錯誤信息
  - 控制台日誌

---

**祝您使用愉快！🎉**
