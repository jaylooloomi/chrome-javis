// Options page — model endpoint, form-fill model preference, and profile.

import { loadLLMConfig, saveLLMConfig, loadFillProvider, saveFillProvider } from '../../shared/config.js';
import { testConnection } from '../../core/llm-client.js';
import { nanoAvailability, ensureNanoDownloaded } from '../../core/nano-client.js';
import { loadProfile, saveProfile, partitionProfile, STANDARD_FIELDS } from '../../shared/profile.js';

const $ = (id) => document.getElementById(id);
const setMsg = (el, text, kind = '') => { el.textContent = text; el.className = `msg ${kind}`; };

// ---- Model endpoint --------------------------------------------------------

const modelFields = { baseURL: $('baseURL'), model: $('model'), apiKey: $('apiKey') };
const modelMsg = $('modelMsg');

const PRESETS = {
  ollama: { baseURL: 'http://localhost:11434/v1', model: 'minimax-m2.5:cloud', apiKey: '' },
  demo: { baseURL: 'https://page-ag-testing-ohftxirgbn.cn-shanghai.fcapp.run/v1', model: 'qwen3.5-plus', apiKey: 'NA' },
};

document.querySelectorAll('.presets button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const p = PRESETS[btn.dataset.preset];
    if (!p) return;
    modelFields.baseURL.value = p.baseURL;
    modelFields.model.value = p.model;
    modelFields.apiKey.value = p.apiKey;
    setMsg(modelMsg, 'Preset filled — Save to apply.');
  });
});

$('saveModel').addEventListener('click', async () => {
  await saveLLMConfig({ baseURL: modelFields.baseURL.value, model: modelFields.model.value, apiKey: modelFields.apiKey.value });
  setMsg(modelMsg, 'Saved.', 'ok');
});

$('testModel').addEventListener('click', async () => {
  setMsg(modelMsg, 'Testing…');
  const res = await testConnection({ baseURL: modelFields.baseURL.value, model: modelFields.model.value, apiKey: modelFields.apiKey.value });
  if (res.ok) setMsg(modelMsg, `Connected. Reply: "${res.reply}"`, 'ok');
  else setMsg(modelMsg, `Failed (${res.reason || 'error'}): ${res.error}`, 'err');
});

// ---- Form-fill model -------------------------------------------------------

const fillMsg = $('fillMsg');
const nanoStatus = $('nanoStatus');
const downloadNano = $('downloadNano');

async function refreshNanoStatus() {
  const a = await nanoAvailability();
  const label = {
    available: 'Nano: ready ✓',
    downloadable: 'Nano: available, needs download',
    downloading: 'Nano: downloading…',
    unavailable: 'Nano: not supported on this device',
    'no-api': 'Nano: not available in this Chrome',
  }[a] || `Nano: ${a}`;
  nanoStatus.textContent = label;
  downloadNano.hidden = a !== 'downloadable';
}

downloadNano.addEventListener('click', async () => {
  downloadNano.disabled = true;
  setMsg(fillMsg, 'Downloading on-device model…');
  try {
    await ensureNanoDownloaded((p) => setMsg(fillMsg, `Downloading… ${Math.round(p * 100)}%`));
    setMsg(fillMsg, 'On-device model ready.', 'ok');
  } catch (err) {
    setMsg(fillMsg, `Download failed: ${err.message}`, 'err');
  } finally {
    downloadNano.disabled = false;
    refreshNanoStatus();
  }
});

$('saveFill').addEventListener('click', async () => {
  await saveFillProvider($('fillProvider').value);
  setMsg(fillMsg, 'Saved.', 'ok');
});

// ---- Profile ---------------------------------------------------------------

const profileMsg = $('profileMsg');
const standardWrap = $('standardFields');
const customFields = $('customFields');

function renderStandardInputs(standard) {
  standardWrap.replaceChildren();
  for (const f of STANDARD_FIELDS) {
    const label = document.createElement('label');
    label.textContent = f.label;
    label.setAttribute('for', `pf_${f.key}`);
    const input = document.createElement('input');
    input.id = `pf_${f.key}`;
    input.dataset.key = f.key;
    input.value = standard[f.key] || '';
    standardWrap.append(label, input);
  }
}

function readProfileForm() {
  const profile = {};
  standardWrap.querySelectorAll('input[data-key]').forEach((el) => {
    if (el.value.trim()) profile[el.dataset.key] = el.value.trim();
  });
  for (const line of customFields.value.split('\n')) {
    const m = line.match(/^\s*([^=]+?)\s*=\s*(.+?)\s*$/);
    if (m) profile[m[1].trim()] = m[2].trim();
  }
  return profile;
}

$('saveProfile').addEventListener('click', async () => {
  await saveProfile(readProfileForm());
  setMsg(profileMsg, 'Profile saved (encrypted).', 'ok');
});

// ---- Init ------------------------------------------------------------------

async function init() {
  const cfg = await loadLLMConfig();
  modelFields.baseURL.value = cfg.baseURL;
  modelFields.model.value = cfg.model;
  modelFields.apiKey.value = cfg.apiKey;

  $('fillProvider').value = await loadFillProvider();
  refreshNanoStatus();

  const { standard, custom } = partitionProfile(await loadProfile());
  renderStandardInputs(standard);
  customFields.value = Object.entries(custom).map(([k, v]) => `${k} = ${v}`).join('\n');
}

init();
