// Snapfill side panel — one-click form fill with preview/confirm.

import { MSG, sendToTab } from '../../shared/messages.js';
import { planFillForTab, applyFillToTab } from './fill-controller.js';

const $ = (id) => document.getElementById(id);
const els = {
  fillBtn: $('fillBtn'),
  fillPreview: $('fillPreview'),
  fillStatus: $('fillStatus'),
  settings: $('settingsBtn'),
  openSettings: $('openSettings'),
};

function setStatus(text, kind = '') {
  els.fillStatus.textContent = text;
  els.fillStatus.className = `status ${kind}`;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function ensureContent(tabId) {
  try {
    const pong = await sendToTab(tabId, { type: MSG.PING });
    return !!pong?.ok;
  } catch {
    return false;
  }
}

const FILL_REASONS = {
  'no-content': 'Open a normal web page (http/https) first.',
  'no-fields': 'No fillable form found on this page.',
  'no-profile': 'Add your details in Settings → Profile first.',
  'llm-failed': 'The model could not be reached. Check Settings.',
  'nothing-matched': 'No profile data matched this form.',
};

function renderPreview(tabId, result) {
  const list = document.createElement('ul');
  list.className = 'preview-list';
  for (const row of result.preview) {
    const li = document.createElement('li');
    const k = document.createElement('span');
    k.className = 'pk';
    k.textContent = row.label;
    const v = document.createElement('span');
    v.className = 'pv';
    v.textContent = typeof row.value === 'boolean' ? (row.value ? '✓ checked' : '✗ unchecked') : row.value;
    li.append(k, v);
    list.append(li);
  }

  const actions = document.createElement('div');
  actions.className = 'preview-actions';
  const confirm = document.createElement('button');
  confirm.className = 'primary';
  confirm.textContent = 'Confirm fill';
  const cancel = document.createElement('button');
  cancel.className = 'ghost';
  cancel.textContent = 'Cancel';

  confirm.addEventListener('click', async () => {
    confirm.disabled = true;
    setStatus('Filling…');
    try {
      const res = await applyFillToTab(tabId, result.plan);
      if (res?.reason === 'page-changed') {
        setStatus('The page changed — click "Fill this form" again.', 'err');
      } else {
        setStatus(`✓ Filled ${res?.applied ?? 0} field(s).${res?.failed ? ` (${res.failed} skipped)` : ''}`, 'ok');
      }
    } catch (err) {
      setStatus(`✗ ${err.message}`, 'err');
    }
    els.fillPreview.hidden = true;
  });
  cancel.addEventListener('click', () => {
    els.fillPreview.hidden = true;
    setStatus('Cancelled.');
  });

  actions.append(confirm, cancel);
  els.fillPreview.replaceChildren(list, actions);
  els.fillPreview.hidden = false;
}

async function onFillForm() {
  const tab = await getActiveTab();
  if (!tab) return setStatus('No active tab.', 'err');
  if (!(await ensureContent(tab.id))) {
    return setStatus(FILL_REASONS['no-content'], 'err');
  }

  els.fillPreview.hidden = true;
  els.fillPreview.replaceChildren();
  els.fillBtn.disabled = true;
  setStatus('Reading the form…');
  try {
    const result = await planFillForTab(tab.id);
    if (!result.ok) {
      setStatus(FILL_REASONS[result.reason] || result.error || result.reason, 'err');
      return;
    }
    renderPreview(tab.id, result);
    setStatus(`Proposed ${result.preview.length} field(s) via ${result.usingNano ? 'on-device Nano' : 'your endpoint'}. Review and confirm.`);
  } catch (err) {
    setStatus(`✗ ${err.message}`, 'err');
  } finally {
    els.fillBtn.disabled = false;
  }
}

els.fillBtn.addEventListener('click', onFillForm);
els.settings.addEventListener('click', () => chrome.runtime.openOptionsPage());
els.openSettings.addEventListener('click', () => chrome.runtime.openOptionsPage());

// If opened via the Alt+Shift+F shortcut, run the fill immediately.
(async () => {
  const { 'snapfill.pendingFill': pending } = await chrome.storage.local.get('snapfill.pendingFill');
  if (pending) {
    await chrome.storage.local.remove('snapfill.pendingFill');
    onFillForm();
  }
})();
