#!/usr/bin/env node

/**
 * Chrome 擴展構建腳本
 * 用途：將所有必需文件複製到 public/ 文件夾進行打包
 * 執行：node build-for-chrome.js
 */

const fs = require('fs');
const path = require('path');

// ========== 配置 ==========
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// 需要複製的文件清單
const FILES_TO_COPY = [
    // 核心文件
    'manifest.json',
    'service-worker.js',
    'config.json',
    
    // UI 頁面
    'sidepanel.html',
    'sidepanel.js',
    'options.html',
    'options.js',
    'settings.html',
    'settings.js',
    'cache-history.html',
    'cache-history.js',
    
    // 工具文件
    'crypto-utils.js',
    'toast-notification.js',
    'options-loader.js',
    'settings-loader.js',
];

// 需要複製的文件夾
const DIRS_TO_COPY = [
    'skills',      // 所有技能
    'i18n',        // 國際化資源
];

// 需要創建但不複製內容的文件夾
const DIRS_TO_CREATE = [
    
];

// ========== 工具函數 ==========

/**
 * 刪除整個目錄
 */
function deleteDir(dir) {
    if (!fs.existsSync(dir)) {
        return;
    }
    
    fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.lstatSync(filePath).isDirectory()) {
            deleteDir(filePath);
        } else {
            fs.unlinkSync(filePath);
        }
    });
    fs.rmdirSync(dir);
}

/**
 * 遞歸複製目錄
 */
function copyDir(src, dest, options = {}) {
    const { exclude = [] } = options;
    
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    fs.readdirSync(src).forEach(file => {
        // 跳過排除的文件/文件夾
        if (exclude.includes(file)) {
            return;
        }
        
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        const stat = fs.lstatSync(srcPath);
        
        if (stat.isDirectory()) {
            copyDir(srcPath, destPath, options);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    });
}

/**
 * 複製單個文件
 */
function copyFile(src, dest) {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
}

/**
 * 創建空目錄
 */
function createEmptyDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// ========== 主構建邏輯 ==========

function buildForChrome() {
    console.log('🚀 開始構建 Chrome 擴展...\n');
    
    // 1. 清空 public 目錄
    console.log('📦 清空 public 目錄...');
    if (fs.existsSync(PUBLIC_DIR)) {
        deleteDir(PUBLIC_DIR);
        console.log('✅ public 目錄已清空\n');
    }
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    
    // 2. 複製單個文件
    console.log('📄 複製單個文件...');
    let copiedCount = 0;
    FILES_TO_COPY.forEach(file => {
        const src = path.join(ROOT_DIR, file);
        const dest = path.join(PUBLIC_DIR, file);
        
        if (fs.existsSync(src)) {
            copyFile(src, dest);
            console.log(`  ✅ ${file}`);
            copiedCount++;
        } else {
            console.log(`  ⚠️  ${file} (未找到)`);
        }
    });
    console.log(`✅ 複製 ${copiedCount}/${FILES_TO_COPY.length} 個文件\n`);
    
    // 3. 複製文件夾
    console.log('📁 複製文件夾...');
    DIRS_TO_COPY.forEach(dir => {
        const src = path.join(ROOT_DIR, dir);
        const dest = path.join(PUBLIC_DIR, dir);
        
        if (fs.existsSync(src)) {
            copyDir(src, dest);
            console.log(`  ✅ ${dir}/`);
        } else {
            console.log(`  ⚠️  ${dir}/ (未找到)`);
        }
    });
    console.log(`✅ 複製 ${DIRS_TO_COPY.length} 個文件夾\n`);
    
    // 4. 創建空目錄
    console.log('📂 創建空目錄...');
    DIRS_TO_CREATE.forEach(dir => {
        const dest = path.join(PUBLIC_DIR, dir);
        createEmptyDir(dest);
        console.log(`  ✅ ${dir}/ (空文件夾，供存放圖片使用)`);
    });
    console.log(`✅ 創建 ${DIRS_TO_CREATE.length} 個空目錄\n`);
    
    // 5. 驗證打包內容
    console.log('🔍 驗證打包內容...');
    const stats = getDirectoryStats(PUBLIC_DIR);
    console.log(`  📊 總文件數: ${stats.files}`);
    console.log(`  📊 總文件夾數: ${stats.dirs}`);
    console.log(`  📊 總大小: ${(stats.size / 1024).toFixed(2)} KB\n`);
    
    // 6. 顯示構建完成訊息
    console.log('=' .repeat(50));
    console.log('✨ 構建完成！');
    console.log('=' .repeat(50));
    console.log(`\n📦 打包路徑: ${PUBLIC_DIR}`);
    console.log('\n⏭️  下一步：');
    console.log('1. 在 Chrome 開啟 chrome://extensions/');
    console.log('2. 打開「開發者模式」');
    console.log(`3. 點擊「載入未封裝的擴充功能」，選擇 ${PUBLIC_DIR} 資料夾`);
    console.log('4. 或上傳到 Chrome Web Store\n');
}

/**
 * 獲取目錄統計信息
 */
function getDirectoryStats(dir, stats = { files: 0, dirs: 0, size: 0 }) {
    if (!fs.existsSync(dir)) {
        return stats;
    }
    
    fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.lstatSync(filePath);
        
        if (stat.isDirectory()) {
            stats.dirs++;
            getDirectoryStats(filePath, stats);
        } else {
            stats.files++;
            stats.size += stat.size;
        }
    });
    
    return stats;
}

// ========== 執行 ==========
try {
    buildForChrome();
    process.exit(0);
} catch (error) {
    console.error('❌ 構建失敗:', error.message);
    process.exit(1);
}
