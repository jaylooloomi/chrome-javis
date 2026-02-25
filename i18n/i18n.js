// ======== 國際化 (i18n) 工具 ========

class I18n {
    constructor() {
        this.translations = {};
        this.currentLanguage = 'zh-TW';
        this.fallbackLanguage = 'zh-TW';
        this.isLoaded = false;
    }

    // 載入翻譯文件
    async load() {
        try {
            const response = await fetch(chrome.runtime.getURL('i18n/locales.json'));
            this.translations = await response.json();
            this.isLoaded = true;
            console.log('[i18n] 翻譯檔案已加載');
            
            // 從 storage 加載語言設定
            await this.loadLanguageFromStorage();
        } catch (error) {
            console.error('[i18n] 加載翻譯檔案失敗:', error);
        }
    }

    // 從 storage 加載語言設定
    async loadLanguageFromStorage() {
        return new Promise((resolve) => {
            chrome.storage.sync.get('micLanguage', (result) => {
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
        const translations = this.translations[this.currentLanguage];
        if (!translations) {
            console.warn(`[i18n] 未找到語言: ${this.currentLanguage}`);
            return key;
        }

        const keys = key.split('.');
        let value = translations;
        
        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                console.warn(`[i18n] 未找到翻譯鍵: ${key} (語言: ${this.currentLanguage})`);
                return key;
            }
        }

        return value || key;
    }

    // 監聽語言變更
    onLanguageChange(callback) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'sync' && changes.micLanguage) {
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
