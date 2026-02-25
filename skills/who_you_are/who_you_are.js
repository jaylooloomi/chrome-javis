// who_you_are.js - 在 SidePanel 中執行的技能
// 介紹 OmniAssistant 和自己的身份

export async function who_you_are(args) {
    console.log("[Who You Are Skill] 啟動");

    try {
        const introduction = `
🤖 **我是 OmniAssistant (Jarvis)**

我是一個智能 Chrome 擴展助手，具備以下核心能力：

✨ **我能做什麼：**

1️⃣ **📖 打開網站** (Open Tab)
   - 幫你快速打開任何網站
   - 支援 Google、YouTube、GitHub、Twitter 等常見網站
   - 命令範例："打開 Google"、"open YouTube"

2️⃣ **📝 總結頁面** (Summarize Page)
   - 智能總結當前網頁內容
   - 支援 Gemini 和本地 Ollama 模型
   - 命令範例："總結這個頁面"、"summarize this page"

3️⃣ **🎤 語音識別**
   - 實時語音輸入，自動執行
   - 支援中文和英文
   - 無需手動點擊運行

🔧 **我的特點：**
- 🧠 支援多個 AI 模型（Gemini 2.5 Flash、Ollama Gemma 等）
- 🎯 精準的意圖識別
- ⚡ 快速響應
- 🛡️ 安全隱私保護

💬 **如何使用：**
- 在輸入框輸入指令或語音說話
- 我會理解你的意圖並執行對應技能
- 或者點擊「執行」按鈕

🌟 **AI 驅動的智能助手** - 讓你的瀏覽體驗更高效！

---
有什麼需要幫助的嗎？你可以問我：
- "打開 Google"
- "總結這個頁面" 
- "介紹你的功能"
        `.trim();

        console.log("[Who You Are Skill] 成功返回介紹");
        return introduction;

    } catch (error) {
        console.error("[Who You Are Skill] 執行失敗:", error);
        throw new Error(`介紹自己失敗: ${error.message}`);
    }
}
