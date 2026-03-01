// page_scroll.js - 在網頁前端執行的技能
// 滾動當前頁面向上、向下或跳到頂部/底部

export async function page_scroll(args) {
    console.log("[Page Scroll Skill] 啟動，接收到參數:", args);

    try {
        const direction = args.direction;
        
        if (!direction) {
            throw new Error("未提供滾動方向 (direction)");
        }

        // 驗證方向值
        const validDirections = ['down', 'up', 'top', 'bottom'];
        if (!validDirections.includes(direction.toLowerCase())) {
            throw new Error(`無效的滾動方向: ${direction}。必須是: ${validDirections.join(', ')}`);
        }

        // 滾動距離設定
        const SCROLL_AMOUNT = 500; // 像素

        // 根據方向執行滾動
        switch (direction.toLowerCase()) {
            case 'down':
                console.log("[Page Scroll Skill] 向下滾動", SCROLL_AMOUNT, "像素");
                window.scrollBy({
                    top: SCROLL_AMOUNT,
                    left: 0,
                    behavior: 'smooth'
                });
                return "✅ 向下滾動";
            
            case 'up':
                console.log("[Page Scroll Skill] 向上滾動", SCROLL_AMOUNT, "像素");
                window.scrollBy({
                    top: -SCROLL_AMOUNT,
                    left: 0,
                    behavior: 'smooth'
                });
                return "✅ 向上滾動";
            
            case 'top':
                console.log("[Page Scroll Skill] 滾到頁面頂部");
                window.scrollTo({
                    top: 0,
                    left: 0,
                    behavior: 'smooth'
                });
                return "✅ 滾到頂部";
            
            case 'bottom':
                console.log("[Page Scroll Skill] 滾到頁面底部");
                window.scrollTo({
                    top: document.body.scrollHeight,
                    left: 0,
                    behavior: 'smooth'
                });
                return "✅ 滾到底部";
            
            default:
                throw new Error(`未知的滾動方向: ${direction}`);
        }
        
    } catch (error) {
        console.error("[Page Scroll Skill] 錯誤:", error);
        throw new Error(`滾動失敗：${error.message}`);
    }
}
