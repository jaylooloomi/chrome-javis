// ========= crypto-utils.js - API Key 加密工具 =========
// 使用 Web Crypto API (AES-GCM) 對 API Key 進行加密/解密
// 加密金鑰由 chrome.storage.local 的 extensionId 衍生，不離開裝置

const CRYPTO_KEY_NAME = 'javis_enc_key';

/**
 * 取得或產生 AES-GCM 加密金鑰（存在 chrome.storage.local）
 */
async function getOrCreateCryptoKey() {
  const result = await chrome.storage.local.get(CRYPTO_KEY_NAME);
  if (result[CRYPTO_KEY_NAME]) {
    // 已有金鑰，匯入使用
    const rawKey = new Uint8Array(result[CRYPTO_KEY_NAME]);
    return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  // 產生新金鑰
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const exported = await crypto.subtle.exportKey('raw', key);
  await chrome.storage.local.set({ [CRYPTO_KEY_NAME]: Array.from(new Uint8Array(exported)) });
  return key;
}

/**
 * 加密字串，回傳 base64 格式（iv + ciphertext）
 */
async function encryptApiKey(plaintext) {
  const key = await getOrCreateCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  // 合併 iv + ciphertext
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

/**
 * 解密 base64 格式的加密字串
 */
async function decryptApiKey(base64) {
  const key = await getOrCreateCryptoKey();
  const combined = new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

/**
 * 遮罩顯示 API Key（只顯示前4碼和後4碼）
 */
function maskApiKey(plaintext) {
  if (!plaintext || plaintext.length < 8) return '••••••••';
  return plaintext.substring(0, 4) + '••••••••••••' + plaintext.slice(-4);
}
