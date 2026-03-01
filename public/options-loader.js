// options-loader.js - 在 options.js 之前加載 i18n
import i18n from './i18n/i18n.js';

// 將 i18n 暴露到全局作用域，供 options.js 使用
window.i18n = i18n;

console.log('[Options Loader] i18n 已導入並暴露到全局');
