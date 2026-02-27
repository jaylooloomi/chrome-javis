// download_all_images.js - 在 SidePanel 中執行的技能
// 下載頁面上的所有圖片

export async function download_all_images(args) {
    console.log("[Download All Images Skill] 啟動，接收到參數:", args);

    try {
        const targetTabId = args.tabId;
        const url = args.url;

        if (!targetTabId) {
            throw new Error("未提供目標標籤頁 tabId");
        }

        console.log("[Skill] 準備設定下載路徑...");

        // 1. 修改全域狀態，讓 SidePanel 的監聽器知道接下來要怎麼做
        window.currentDownloadConfig = {
            skillName: "download_all_images",
            tabId: args.tabId?.toString() || "unknown",
            title: args.title || "unknown_page",
            active: true // 開啟攔截模式
        };

        // 1. 注入腳本到目標頁面，抓取所有圖片 URL
        console.log("[Download All Images Skill] 正在從 tabId", targetTabId, "抓取所有圖片 URL");
        const results = await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            function: () => {
                // 這裡是在「網頁環境」執行，抓完就跑，不跑下載
                const imgs = Array.from(document.querySelectorAll('img'));
                const imageUrls = imgs
                    .map(img => img.src || img.getAttribute('data-src'))
                    .filter(src => src && (src.startsWith('http') || src.startsWith('data:') || src.startsWith('blob:')))
                    .filter((src, index, array) => array.indexOf(src) === index); // 去重

                console.log("[Download Script] 找到", imageUrls.length, "個圖片");
                return imageUrls;
            }
        });

        const imageUrls = results[0].result;
        console.log("[Download All Images Skill] 共抓取", imageUrls.length, "個圖片 URL");

        if (imageUrls.length === 0) {
            throw new Error("此頁面上沒有找到任何圖片");
        }

        // 2. 在「管理員環境」執行下載 (這裡有 chrome.downloads 權限！)
        console.log("[Download All Images Skill] 正在啟動下載任務...");

        let successCount = 0;
        let failureCount = 0;
        await imageUrls.forEach((imageUrl, index) => {
            // 構建文件名 (不需要路徑，監聽器會自動添加)
            const fileName = `image_${String(index + 1).padStart(String(imageUrls.length).length, '0')}.jpg`;

            chrome.downloads.download(
                {
                    url: imageUrl,
                    saveAs: false,
                    filename: fileName,
                },
                (downloadId) => {
                    if (downloadId !== undefined) {
                        successCount++;
                        console.log("[Download All Images Skill] 已啟動下載任務", downloadId, "URL:", imageUrl);
                    } else {
                        failureCount++;
                        console.error("[Download All Images Skill] 下載失敗:", imageUrl, "Error:", chrome.runtime.lastError?.message);
                    }
                }
            );
        });

        console.log("[Download All Images Skill] 操作完成");
        return `✅ 已啟動 ${imageUrls.length} 個圖片下載任務\n\n📸 圖片來自：${url}`;

    } catch (error) {
        console.error("[Download All Images Skill] 錯誤:", error);
        throw new Error(`下載所有圖片失敗：${error.message}`);
    }
}
