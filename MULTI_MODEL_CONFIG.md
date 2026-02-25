# 🤖 多模型支持配置指南

## 📋 概述

OmniAssistant 现在支持两个 AI 模型：
- **Gemini 2.5 Flash** (云端，需要 API Key)
- **Ollama gemma2:2b** (本地，需要本地 Ollama 服务)

通过编辑 `config.json` 文件可以轻松切换使用的模型。

---

## ⚙️ 配置文件说明

### config.json 结构

```json
{
  "activeModel": "gemini",
  
  "gemini": {
    "apiKey": "YOUR_GEMINI_API_KEY",
    "model": "gemini-2.5-flash",
    "temperature": 0.3,
    "maxOutputTokens": 2048
  },
  
  "ollama": {
    "baseUrl": "http://localhost:11434",
    "model": "gemma2:2b",
    "temperature": 0.3,
    "numPredict": 2048
  }
}
```

---

## 🚀 快速开始

### 方案 A：使用 Gemini (默认)

1. **获取 API Key：**
   - 访问 [Google AI Studio](https://aistudio.google.com/app/apikeys)
   - 创建新的 API Key

2. **配置 config.json：**
   ```json
   {
     "activeModel": "gemini",
     "gemini": {
       "apiKey": "YOUR_GEMINI_API_KEY_HERE",
       "model": "gemini-2.5-flash",
       "temperature": 0.3,
       "maxOutputTokens": 2048
     },
     ...
   }
   ```

3. **重新加载扩展**并使用

### 方案 B：使用 Ollama

1. **安装 Ollama：**
   ```bash
   # 访问 https://ollama.ai 下载安装
   ```

2. **拉取 gemma2:2b 模型：**
   ```bash
   ollama pull gemma2:2b
   ```

3. **启动 Ollama 服务：**
   ```bash
   ollama serve
   # 默认运行在 http://localhost:11434
   ```

4. **配置 config.json：**
   ```json
   {
     "activeModel": "ollama",
     "ollama": {
       "baseUrl": "http://localhost:11434",
       "model": "gemma2:2b",
       "temperature": 0.3,
       "numPredict": 2048
     },
     ...
   }
   ```

5. **重新加载扩展**并使用

---

## 🔄 模型切换

要切换模型，只需修改 `activeModel` 字段：

```json
// 使用 Gemini
"activeModel": "gemini"

// 使用 Ollama
"activeModel": "ollama"
```

然后重新加载扩展即可。

---

## 📝 配置参数详解

### Gemini 配置

| 参数 | 说明 | 示例 |
|------|------|------|
| `apiKey` | Google AI API Key | `AIzaSyD...` |
| `model` | 使用的模型 | `gemini-2.5-flash` |
| `temperature` | 创意程度 (0-1) | `0.3` (保守) |
| `maxOutputTokens` | 最大输出长度 | `2048` |

### Ollama 配置

| 参数 | 说明 | 示例 |
|------|------|------|
| `baseUrl` | Ollama 服务地址 | `http://localhost:11434` |
| `model` | 使用的模型 | `gemma2:2b` |
| `temperature` | 创意程度 (0-1) | `0.3` (保守) |
| `numPredict` | 最大输出长度 | `2048` |

---

## 🔍 工作流程

```
Side Panel
    ↓
输入文本 + 点击执行
    ↓
读取 config.json
    ↓
检查 activeModel 字段
    ├─ "gemini" → 调用 callGeminiFlash()
    └─ "ollama" → 调用 callOllama()
    ↓
调用相应 API
    ↓
接收 AI 响应
    ↓
解析 JSON 指令
    ↓
分发给相应技能
    ↓
执行技能
    ↓
显示结果
```

---

## 🧪 测试

### 测试 Gemini

```
输入：打开 Google
预期：新分页打开 Google
```

### 测试 Ollama

首先确保 Ollama 正在运行：
```bash
ollama serve
```

然后输入相同指令进行测试。

---

## 🐛 故障排除

### Gemini 无法连接

```
❌ 错误: Gemini API 错误 403: Invalid API Key
```

**解决方案：**
1. 检查 API Key 是否正确
2. 访问 [Google AI Studio](https://aistudio.google.com/app/apikeys) 重新创建

### Ollama 无法连接

```
❌ 错误: Ollama API 错误: Failed to fetch
```

**解决方案：**
1. 确保 Ollama 已启动：`ollama serve`
2. 检查 baseUrl 是否正确（默认 `http://localhost:11434`）
3. 确保已拉取 gemma2:2b 模型：`ollama pull gemma2:2b`

### 网络错误

```
❌ 错误: Network error
```

**解决方案：**
1. 检查互联网连接（Gemini）
2. 检查本地网络（Ollama）
3. 查看浏览器控制台获取更多信息

---

## 📌 重要提示

⚠️ **安全性：**
- 不要在公共地方提交包含真实 API Key 的 config.json
- 将 API Key 存储在 .gitignore 中保护的文件中

⚠️ **模型差异：**
- **Gemini** - 云端，快速，更准确，需要网络
- **Ollama** - 本地，隐私安全，速度较慢，需要本地计算资源

✅ **性能对比：**
| 方面 | Gemini | Ollama |
|------|--------|--------|
| 速度 | ⚡⚡⚡ 很快 | ⚡ 较慢 |
| 准确性 | ★★★★★ | ★★★★ |
| 隐私 | 云端 | 本地 |
| 成本 | 免费额度 | 免费 |
