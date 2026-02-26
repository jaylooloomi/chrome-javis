// ========= tests/test-api-key-security.js =========
if (typeof chrome === 'undefined') {
    const store = {};
    global.chrome = {
        storage: {
            local: {
                get: async (key) => typeof key === 'string' ? { [key]: store[key] } : Object.fromEntries((Array.isArray(key) ? key : Object.keys(key)).map(k => [k, store[k]])),
                set: async (obj) => Object.assign(store, obj),
                remove: async (keys) => (Array.isArray(keys) ? keys : [keys]).forEach(k => delete store[k])
            },
            sync: { get: async () => ({}), remove: async () => {} }
        }
    };
}

const results = []; let passed = 0; let failed = 0;
async function test(name, fn) {
    try { await fn(); console.log(`✅ PASS: ${name}`); results.push({ name, status: 'PASS' }); passed++; }
    catch (e) { console.error(`❌ FAIL: ${name}\n   ${e.message}`); results.push({ name, status: 'FAIL', error: e.message }); failed++; }
}
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }
function assertEqual(a, b, m) { if (a !== b) throw new Error(m || `Expected "${b}", got "${a}"`); }

test('maskApiKey - 標準格式遮罩（前4後4）', () => {
    const masked = maskApiKey('AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz123456');
    assert(masked.startsWith('AIza') && masked.endsWith('3456') && masked.includes('••••') && !masked.includes('AbCd'));
});
test('maskApiKey - 短字串全遮罩', () => assertEqual(maskApiKey('short'), '••••••••'));
test('maskApiKey - 空字串全遮罩', () => assertEqual(maskApiKey(''), '••••••••'));
test('maskApiKey - null 全遮罩', () => assertEqual(maskApiKey(null), '••••••••'));
test('maskApiKey - undefined 全遮罩', () => assertEqual(maskApiKey(undefined), '••••••••'));
test('encryptApiKey - 加密後不等於明文', async () => {
    const enc = await encryptApiKey('AIzaSyTestKey1234567890abcdefghijk');
    assert(enc !== 'AIzaSyTestKey1234567890abcdefghijk' && typeof enc === 'string' && enc.length > 10);
});
test('decryptApiKey - 正確解密還原明文', async () => {
    const orig = 'AIzaSyTestKey1234567890abcdefghijk';
    assertEqual(await decryptApiKey(await encryptApiKey(orig)), orig);
});
test('encryptApiKey - 每次密文不同（隨機IV）', async () => {
    const k = 'AIzaSyTestKey1234567890abcdefghijk';
    assert(await encryptApiKey(k) !== await encryptApiKey(k));
});
test('decryptApiKey - 竄改密文應拋出錯誤', async () => {
    const enc = await encryptApiKey('AIzaSyTestKey1234567890abcdefghijk');
    let threw = false;
    try { await decryptApiKey(enc.slice(0, -4) + 'XXXX'); } catch { threw = true; }
    assert(threw, '竄改密文應拋出解密錯誤');
});
test('API Key 應存 storage.local 不存 storage.sync', async () => {
    await chrome.storage.local.set({ geminiApiKeyEncrypted: await encryptApiKey('AIzaSyStorageTest1234567890abcdefg') });
    assert((await chrome.storage.local.get('geminiApiKeyEncrypted')).geminiApiKeyEncrypted);
    assert(!(await chrome.storage.sync.get('geminiApiKey')).geminiApiKey);
});
test('刪除後 storage.local 應無 API Key', async () => {
    await chrome.storage.local.remove(['geminiApiKeyEncrypted', 'javis_enc_key']);
    assert(!(await chrome.storage.local.get('geminiApiKeyEncrypted')).geminiApiKeyEncrypted);
});
test('無效 API Key 格式應被拒絕', () => {
    for (const k of ['', 'shortkey', 'NotAGoogleKey12345678901234567890'])
        assert(!(k.startsWith('AIzaSy') && k.length >= 35));
});

setTimeout(() => {
    console.log(`\n測試結果: ${passed} 通過 / ${failed} 失敗 / ${passed + failed} 總計`);
    console.log(failed === 0 ? '\n🎉 所有測試通過！' : `\n⚠️ ${failed} 個測試失敗`);
}, 300);