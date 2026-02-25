# 🎤 OmniAssistant 使用指南

## 📋 核心功能

### 1️⃣ 开启网页 (Open Tab)
**功能：** 快速在新标签页打开指定网站

**使用方式：**
```
- 输入: "打开 Google"
- 输入: "开启 YouTube"  
- 输入: "帮我打开 GitHub"
```

**工作流程：**
```
输入文本 → Gemini 解析意图 → 提取 URL → 在新标签页打开
```

**语音方式：**
```
🎤 点击麦克风按钮 → 说"打开 Google" → 自动识别+执行 → 新分页打开
```

**支持的网站示例：**
- ✅ `google.com` / `google.com.tw`
- ✅ `youtube.com`
- ✅ `github.com`
- ✅ `chatgpt.com`
- ✅ 任何完整的 URL

---

## 🎯 快速开始

### 初次使用（必做）
1. 右键扩展图标 → 选择 **"选项"**
2. 点击 **"🔐 授予麦克风权限"** 按钮
3. Chrome 权限对话框选择 **"允许"**
4. 看到绿色成功提示后关闭

### 日常使用

#### 方式 A：文字输入
```
1. 打开 Side Panel
2. 在输入框输入指令
3. 点击 "执行" 按钮
4. 等待结果
```

#### 方式 B：语音输入（推荐）
```
1. 打开 Side Panel
2. 点击 🎤 麦克风按钮
3. 说话（例如："打开 Google"）
4. 停止说话
5. 自动识别+执行 ✨
```

---

## 📝 指令示例

| 指令 | 结果 |
|------|------|
| "打开 Google" | 在新分页打开 google.com |
| "帮我开启 YouTube" | 在新分页打开 youtube.com |
| "打开 GitHub" | 在新分页打开 github.com |
| "开启 Twitter" | 在新分页打开 twitter.com |

---

## 🔍 工作原理

### 文字流程
```
Side Panel
    ↓
输入文本 "打开 Google"
    ↓
Service Worker（Gateway）
    ↓
调用 Gemini 2.5 Flash API
    ↓
Gemini 解析：
  - 意图：open_tab
  - 参数：url = "https://google.com"
    ↓
返回 JSON 响应
    ↓
Service Worker 执行 open_tab 技能
    ↓
chrome.tabs.create({ url: "https://google.com" })
    ↓
新分页打开 ✅
```

### 语音流程
```
Side Panel
    ↓
点击 🎤 按钮
    ↓
Web Speech API 识别
    ↓
"打开 Google"（实时显示）
    ↓
停止说话 → 自动提交
    ↓
与文字流程相同
```

---

## ⚙️ 架构说明

| 组件 | 职责 |
|------|------|
| **sidepanel.html** | UI 界面（输入框、麦克风按钮、输出区域） |
| **sidepanel.js** | 语音识别、消息发送、结果显示 |
| **service-worker.js** | Gateway（Gemini 调用、技能分发） |
| **open_tab.js** | 执行"打开标签页"功能 |
| **options.html** | 麦克风权限授予页面 |
| **config.json** | API Key 和模型配置 |

---

## 🚀 核心特性

✅ **实时语音识别** - 边说边显示转录文本  
✅ **自动执行** - 语音结束后自动提交  
✅ **多语言支持** - 默认繁体中文（可配置）  
✅ **错误处理** - 友好的错误提示和恢复方案  
✅ **免提操作** - 完全声控，无需手动提交  

---

## 🔧 配置说明

**编辑 `config.json` 修改：**
```json
{
  "geminiApiKey": "YOUR_API_KEY_HERE",
  "model": "gemini-2.5-flash",
  "temperature": 0.7,
  "maxOutputTokens": 1024
}
```

**修改语言（在 `sidepanel.js`）：**
```javascript
recognition.lang = 'zh-TW';  // 繁体中文
// recognition.lang = 'zh-CN';  // 简体中文
// recognition.lang = 'en-US';  // 英文
```

---

## ❓ 常见问题

**Q: 为什么语音没有反应？**  
A: 需要先在选项页面授予麦克风权限。右键扩展 → 选项 → 授予权限

**Q: 怎么修改语言？**  
A: 编辑 `sidepanel.js` 第 12 行，改 `recognition.lang` 的值

**Q: 可以打开其他网站吗？**  
A: 可以！告诉 Gemini 任何网站名称，它会自动生成 URL

**Q: 如何重新授予权限？**  
A: 打开 `chrome://settings/content/microphone`，找到 OmniAssistant，改为"允许"

---

## 📞 技术支持

遇到问题？检查以下项目：
1. ✅ 麦克风已连接
2. ✅ 麦克风在系统设置中启用
3. ✅ 在选项页面已授予权限
4. ✅ 网络连接正常
5. ✅ `config.json` 包含有效的 API Key
