/**
 * Page Control Skill - Navigate previous/next page
 * Executes in page context using window.history API
 */

export async function page_control(args) {
  console.log("[Page Control Skill] 啟動，接收到參數:", args);

  try {
    const direction = args.direction;

    if (!direction) {
      throw new Error("未提供導航方向 (direction)");
    }

    // 驗證方向值
    const validDirections = ['previous', 'next'];
    if (!validDirections.includes(direction.toLowerCase())) {
      throw new Error(`無效的導航方向: ${direction}。必須是: ${validDirections.join(', ')}`);
    }

    // 根據方向執行導航
    switch (direction.toLowerCase()) {
      case 'previous':
        console.log("[Page Control Skill] 導航到上一頁");
        window.history.back();
        return "✅ 已返回上一頁";

      case 'next':
        console.log("[Page Control Skill] 導航到下一頁");
        window.history.forward();
        return "✅ 已前進下一頁";

      default:
        throw new Error(`未知的導航方向: ${direction}`);
    }
  } catch (error) {
    console.error("[Page Control Skill] 錯誤:", error);
    throw new Error(`導航失敗：${error.message}`);
  }
}
