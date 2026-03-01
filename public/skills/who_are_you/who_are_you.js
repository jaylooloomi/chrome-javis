// who_are_you.js - 在 SidePanel 中執行的技能
// 介紹 OmniAssistant 和自己的身份

export async function who_are_you(args) {
    console.log("[Who Are You Skill] 啟動");
    try {
        const introduction = `
🤖 我是 Jarvis, 你的智能助手!
🤖 模型: ${args.modelName || 'Unknown'}
🌍 語言: ${args.language || 'Unknown'}
        `.trim();

        console.log("[Who Are You Skill] 成功返回介紹");
        return introduction;

    } catch (error) {
        console.error("[Who Are You Skill] 執行失敗:", error);
        throw new Error(`介紹自己失敗: ${error.message}`);
    }
}
