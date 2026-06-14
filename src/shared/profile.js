// User profile for form-fill, stored encrypted at rest (it is PII).
// Flat object of key -> value (standard keys + any custom keys). Never synced.

import { encryptString, decryptString } from './crypto-utils.js';

export const PROFILE_KEY = 'snapfill.profile';

export const STANDARD_FIELDS = [
  { key: 'fullName', label: 'Full name' },
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State / Province' },
  { key: 'zip', label: 'Postal code' },
  { key: 'country', label: 'Country' },
  { key: 'company', label: 'Company' },
  { key: 'jobTitle', label: 'Job title' },
];

const STANDARD_KEYS = new Set(STANDARD_FIELDS.map((f) => f.key));

export async function loadProfile() {
  const r = await chrome.storage.local.get(PROFILE_KEY);
  const stored = r[PROFILE_KEY];
  if (!stored) return {};
  if (stored.enc) {
    try {
      return JSON.parse(await decryptString(stored.enc)) || {};
    } catch {
      return {};
    }
  }
  return stored.plain || {};
}

export async function saveProfile(profile) {
  const clean = {};
  for (const [k, v] of Object.entries(profile || {})) {
    if (v != null && String(v).trim() !== '') clean[k] = String(v).trim();
  }
  await chrome.storage.local.set({ [PROFILE_KEY]: { enc: await encryptString(JSON.stringify(clean)) } });
  return clean;
}

/** Split a stored profile into { standard: {key:val}, custom: {key:val} }. */
export function partitionProfile(profile = {}) {
  const standard = {};
  const custom = {};
  for (const [k, v] of Object.entries(profile)) {
    if (STANDARD_KEYS.has(k)) standard[k] = v;
    else custom[k] = v;
  }
  return { standard, custom };
}
