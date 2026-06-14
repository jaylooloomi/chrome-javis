// API-key encryption at rest (AES-GCM via Web Crypto).
//
// HONEST CAVEAT: the AES key is generated once and stored in the same
// chrome.storage.local as the ciphertext, so this is *obfuscation at rest*, not
// protection against an attacker who can already read local storage. It defends
// against casual inspection / accidental disclosure and keeps the key off
// chrome.storage.sync (never leaves the device). True secret protection would
// require a user passphrase, which is out of scope for now.

const CRYPTO_KEY_NAME = 'javis.encKey';

async function getOrCreateCryptoKey() {
  const result = await chrome.storage.local.get(CRYPTO_KEY_NAME);
  if (result[CRYPTO_KEY_NAME]) {
    const rawKey = new Uint8Array(result[CRYPTO_KEY_NAME]);
    return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const exported = await crypto.subtle.exportKey('raw', key);
  await chrome.storage.local.set({ [CRYPTO_KEY_NAME]: Array.from(new Uint8Array(exported)) });
  return key;
}

/** Encrypt a string -> base64 (iv + ciphertext). */
export async function encryptString(plaintext) {
  if (!plaintext) return '';
  const key = await getOrCreateCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

/** Decrypt a base64 (iv + ciphertext) string. Returns '' on failure. */
export async function decryptString(base64) {
  if (!base64) return '';
  try {
    const key = await getOrCreateCryptoKey();
    const combined = new Uint8Array(atob(base64).split('').map((c) => c.charCodeAt(0)));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch {
    return '';
  }
}
