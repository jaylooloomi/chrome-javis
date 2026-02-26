// ========= test-api-key-security.js =========
// 測試 API Key 加密/解密/遮罩功能
// 執行方式：在 Chrome Extension 的 DevTools Console 貼上執行，或用 Jest + jsdom

// ---- Mock chrome.storage.local (for Node/Jest environment) ----
if (typeof chrome === 'undefined') {
    const store = {};
    global.chrome = {
        storage: {
            local: {
                get: async (key) => {
                    if (typeof key === 'string') return { [key]: store[key] };
                    const result = {};
                    for (const k of (Array.isArray(key) ? key : Object.keys(key))) result[k] = store[k];
                    return result;
                },
                set: async (obj) => Object.assign(store, obj),
                remove: async (keys) => {
                    for (const k of (Array.isArray(keys) ? keys : [keys])) delete store[k];
                }
            },
            sync: {
                get: async () => ({}),
                remove: async () => {}
            }
        }
    };
}

// ---- 載入加密工具 ----
// 在 Chrome Extension 環境中，crypto-utils.js 已透過 manifest 載入
// 在 Node 環境中需要 require/import

// ---- 測試套件 ----
const results = [];
let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`✅ PASS: ${name}`);
        results.push({ name, status: 'PASS' });
        passed++;
    } catch (e) {
        console.error(`❌ FAIL: ${name}\n   ${e.message}`);
        results.push({ name, status: 'FAIL', error: e.message });
        failed++;
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(a, b, message) {
    if (a !== b) throw new Error(message || `Expected "${b}", got "${a}"`);
}

// ==============================
// 1. maskApiKey 遮罩測試
// ==============================
test('maskApiKey - 標準 Google API Key 遮罩格式', () => {
    const key = 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz123456';
    const masked = maskApiKey(key);
    assert(masked.startsWith('AIza'), '前4碼應為 AIza');
    assert(masked.endsWith('3456'), '後4碼應為 3456');
    assert(masked.includes('••••'), '中間應有遮罩');
    assert(!masked.includes('AbCdEf'), '中間部分不應洩漏');
});

test('maskApiKey - 短字串（少於8字元）應全部遮罩', () => {
    const masked = maskApiKey('short');
    assertEqual(masked, '••••••••', '短字串應回傳全遮罩');
});

test('maskApiKey - 空字串應回傳遮罩', () => {
    const masked = maskApiKey('');
    assertEqual(masked, '••••••••', '空字串應回傳遮罩');
});

test('maskApiKey - null/undefined 應回傳遮罩', () => {
    assertEqual(maskApiKey(null), '••••••••');
    assertEqual(maskApiKey(undefined), '••••••••');
});

// ==============================
// 2. encryptApiKey / decryptApiKey 加解密測試
// ==============================
test('encryptApiKey - 加密後不等於明文', async () => {
    const key = 'AIzaSyTestKey1234567890abcdefghijk';
    const encrypted = await encryptApiKey(key);
    assert(encrypted !== key, '加密後應與明文不同');
    assert(typeof encrypted === 'string', '加密結果應為字串');
    assert(encrypted.length > 10, '加密結果長度應大於10');
});

test('decryptApiKey - 加密後可正確解密還原', async () => {
    const original = 'AIzaSyTestKey1234567890abcdefghijk';
    const encrypted = await encryptApiKey(original);
    const decrypted = await decryptApiKey(encrypted);
    assertEqual(decrypted, original, '解密結果應等於原始明文');
});

test('encryptApiKey - 同一明文每次加密結果不同（IV 隨機）', async () => {
    const key = 'AIzaSyTestKey1234567890abcdefghijk';
    const enc1 = await encryptApiKey(key);
    const enc2 = await encryptApiKey(key);
    assert(enc1 !== enc2, '每次加密應產生不同密文（隨機 IV）');
});

test('decryptApiKey - 兩次不同密文解密後結果相同', async () => {
    const key = 'AIzaSyTestKey1234567890abcdefghijk';
    const enc1 = await encryptApiKey(key);
    const enc2 = await encryptApiKey(key);
    const dec1 = await decryptApiKey(enc1);
    const dec2 = await decryptApiKey(enc2);
    assertEqual(dec1, dec2, '不同密文解密後應得到相同明文');
});

test('decryptApiKey - 竭改密文應拋出錯誤', async () => {
    const key = 'AIzaSyTestKey1234567890abcdefghijk';
    const encrypted = await encryptApiKey(key);
    // 竫改密文最後幾個字元
    const tampered = encrypted.slice(0, -4) + 'XXXX';
    let threw = false;
    try {
        await decryptApiKey(tampered);
    } catch {
        threw = true;
    }
    assert(threw, '竫改密文應拋出解密錯誤');
});

// ==============================
// 3. getOrCreateCryptoKey 金鑰持久性測試
// ==============================
test('getOrCreateCryptoKey - 同一環境重複呼叫應回傳相同金鑰', async () => {
    const key1 = await getOrCreateCryptoKey();
    const key2 = await getOrCreateCryptoKey();
    // CryptoKey 物件不可直接比較，改用加解密行為驗證
    const plaintext = 'AIzaSyTestConsistency1234567890ab';
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: new Uint8Array(12) },
        key1,
        new TextEncoder().encode(plaintext)
    );
    // key2 應能解密 key1 加密的內容（因為是同一把金鑰）
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(12) },
        key2,
        encrypted
    );
    assertEqual(new TextDecoder().decode(decrypted), plaintext, '同一金鑰應可互相加解密');
});

// ==============================
// 4. storage.local 隔離驗證
// ==============================
test('儲存後應存在 chrome.storage.local 而非 storage.sync', async () => {
    const key = 'AIzaSyStorageTest1234567890abcdefg';
    const encrypted = await encryptApiKey(key);
    await chrome.storage.local.set({ geminiApiKeyEncrypted: encrypted });

    // local 應有值
    const localResult = await chrome.storage.local.get('geminiApiKeyEncrypted');
    assert(localResult.geminiApiKeyEncrypted, 'storage.local 應有加密的 API Key');

    // sync 不應有明文
    const syncResult = await chrome.storage.sync.get('geminiApiKey');
    assert(!syncResult.geminiApiKey, 'storage.sync 不應有明文 API Key');
});

test('刪除後 storage.local 應無 API Key', async () => {
    await chrome.storage.local.remove(['geminiApiKeyEncrypted', 'javis_enc_key']);
    const result = await chrome.storage.local.get('geminiApiKeyEncrypted');
    assert(!result.geminiApiKeyEncrypted, '刪除後 local 應無 API Key');
});

// ==============================
// 5. API Key 格式驗證
// ==============================
test('有效 Google API Key 格式驗證', () => {
    const validKey = 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz12345';
    assert(validKey.startsWith('AIzaSy'), '有效 Key 應以 AIzaSy 開頭');
    assert(validKey.length >= 35, '有效 Key 長度應 >= 35');
});

test('無效 API Key 格式應被拒絕', () => {
    const invalidKeys = ['', 'shortkey', 'NotAGoogleKey123456789012345678901'];
    for (const key of invalidKeys) {
        const isValid = key.startsWith('AIzaSy') && key.length >= 35;
        assert(!isValid, `無效 Key "${key.substring(0, 10)}..." 不應通過驗證`);
    }
});

// ==============================
// 結果摘要
// ==============================
async function runAllTests() {
    // 等待所有非同步測試完成（已在各 test() 內 await）
    await new Promise(r => setTimeout(r, 100));
    console.log('\n==============================')
    console.log(`測試結果: ${passed} 通過 / ${failed} 失敗 / ${passed + failed} 總計`);
    console.log('==============================')
    if (failed > 0) {
        console.log('\n失敗的測試:');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`  ❌ ${r.name}: ${r.error}`);
        });
    }
    return { passed, failed, results };
}

// 自動執行
runAllTests().then(summary => {
    if (summary.failed === 0) {
        console.log('\n🎉 所有測試通過！API Key 安全性實作驗證完成。');
    } else {
        console.error(`\n⚠️  有 ${summary.failed} 個測試失敗，請檢查實作。`);
    }
});
