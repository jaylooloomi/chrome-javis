// Options page — configure the OpenAI-compatible model endpoint.

import { loadLLMConfig, saveLLMConfig } from '../../shared/config.js';
import { testConnection } from '../../core/llm-client.js';

const $ = (id) => document.getElementById(id);
const fields = { baseURL: $('baseURL'), model: $('model'), apiKey: $('apiKey') };
const msg = $('msg');

const PRESETS = {
  ollama: { baseURL: 'http://localhost:11434/v1', model: 'qwen3:14b', apiKey: '' },
  demo: { baseURL: 'https://page-ag-testing-ohftxirgbn.cn-shanghai.fcapp.run/v1', model: 'qwen3.5-plus', apiKey: 'NA' },
};

function readForm() {
  return { baseURL: fields.baseURL.value, model: fields.model.value, apiKey: fields.apiKey.value };
}

function setMsg(text, kind = '') {
  msg.textContent = text;
  msg.className = `msg ${kind}`;
}

async function init() {
  const cfg = await loadLLMConfig();
  fields.baseURL.value = cfg.baseURL;
  fields.model.value = cfg.model;
  fields.apiKey.value = cfg.apiKey;
}

document.querySelectorAll('.presets button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const p = PRESETS[btn.dataset.preset];
    if (!p) return;
    fields.baseURL.value = p.baseURL;
    fields.model.value = p.model;
    fields.apiKey.value = p.apiKey;
    setMsg('Preset filled — Save to apply.');
  });
});

$('save').addEventListener('click', async () => {
  await saveLLMConfig(readForm());
  setMsg('Saved.', 'ok');
});

$('test').addEventListener('click', async () => {
  setMsg('Testing…');
  const res = await testConnection(readForm());
  if (res.ok) setMsg(`Connected. Reply: "${res.reply}"`, 'ok');
  else setMsg(`Failed (${res.reason || 'error'}): ${res.error}`, 'err');
});

init();
