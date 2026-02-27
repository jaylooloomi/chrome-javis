// ======== 國際化 (i18n) 工具 ========

class I18n {
    constructor() {
        this.translations = {};
        this.currentLanguage = 'zh-TW';
        this.fallbackLanguage = 'zh-TW';
        this.isLoaded = false;
    }

    // 載入翻譯文件（支援模組化加載）
    async load(modules = null) {
        try {
            let modulesToLoad = ['sidepanel', 'cache', 'options', 'settings'];
            
            // 如果指定了特定模組，只加載那些
            if (modules) {
                if (typeof modules === 'string') {
                    modulesToLoad = [modules];
                } else if (Array.isArray(modules)) {
                    modulesToLoad = modules;
                }
            }
            
            // 載入所有指定的模組
            for (const module of modulesToLoad) {
                try {
                    const response = await fetch(chrome.runtime.getURL(`i18n/locales/${module}.json`));
                    const moduleData = await response.json();
                    
                    // 合併模組數據到 translations
                    for (const language in moduleData) {
                        if (!this.translations[language]) {
                            this.translations[language] = {};
                        }
                        this.translations[language] = {
                            ...this.translations[language],
                            ...moduleData[language]
                        };
                    }
                    console.log(`[i18n] 模組 '${module}' 已加載`);
                } catch (error) {
                    console.warn(`[i18n] 加載模組 '${module}' 失敗:`, error);
                }
            }
            
            this.isLoaded = true;
            console.log('[i18n] 翻譯檔案已加載（模組化）');
            
            // 從 storage 加載語言設定
            await this.loadLanguageFromStorage();
        } catch (error) {
            console.error('[i18n] 加載翻譯檔案失敗:', error);
        }
    }

    // 從 storage 加載語言設定
    async loadLanguageFromStorage() {
        return new Promise((resolve) => {
            chrome.storage.local.get('micLanguage', (result) => {
                const language = result.micLanguage || 'zh-TW';
                this.setLanguage(language);
                resolve(language);
            });
        });
    }

    // 設定當前語言
    setLanguage(language) {
        // 驗證語言是否存在，否則使用預設語言
        if (this.translations[language]) {
            this.currentLanguage = language;
            console.log(`[i18n] 語言已設定為: ${language}`);
        } else {
            console.warn(`[i18n] 不支持的語言: ${language}, 使用預設: ${this.fallbackLanguage}`);
            this.currentLanguage = this.fallbackLanguage;
        }
    }

    // 獲取翻譯文本
    t(key) {
        // 如果还未加载，返回 key 本身作为备用
        if (!this.isLoaded) {
            console.warn(`[i18n] i18n 還未加載，無法翻譯: ${key}`);
            return key;
        }

        const translations = this.translations[this.currentLanguage];
        if (!translations) {
            console.warn(`[i18n] 未找到語言: ${this.currentLanguage}`);
            return key;
        }

        // 直接查找键（翻译文件使用平坦键结构）
        const value = translations[key];
        
        if (value === undefined) {
            console.warn(`[i18n] 未找到翻譯鍵: ${key} (語言: ${this.currentLanguage})`);
            return key;
        }

        return value;
    }

    // 監聽語言變更
    onLanguageChange(callback) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes.micLanguage) {
                const newLanguage = changes.micLanguage.newValue;
                this.setLanguage(newLanguage);
                console.log('[i18n] 語言已更新:', newLanguage);
                callback(newLanguage);
            }
        });
    }

    // 獲取所有支持的語言
    getSupportedLanguages() {
        return Object.keys(this.translations);
    }

    // 獲取當前語言
    getCurrentLanguage() {
        return this.currentLanguage;
    }
}

// 建立全局 i18n 實例
const i18n = new I18n();

export default i18n;
