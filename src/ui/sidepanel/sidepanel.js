// Side panel — the product UI. Orchestrates learning, lists the skill library,
// and runs (replays) skills against the active tab's content script.

import { SkillStore, createChromeAdapter } from '../../core/skill-store.js';
import { loadLLMConfig } from '../../shared/config.js';
import { MSG, sendToTab } from '../../shared/messages.js';
import { learnViaTab } from './learn-controller.js';

const store = new SkillStore(createChromeAdapter());

const $ = (id) => document.getElementById(id);
const els = {
  task: $('taskInput'),
  name: $('skillName'),
  learn: $('learnBtn'),
  status: $('status'),
  list: $('skillList'),
  empty: $('emptyHint'),
  settings: $('settingsBtn'),
  importBtn: $('importBtn'),
  importFile: $('importFile'),
  exportAll: $('exportAllBtn'),
};

function setStatus(text, kind = '') {
  els.status.textContent = text;
  els.status.className = `status ${kind}`;
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

function fmtTime(ts) {
  if (!ts) return 'never';
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function skillRow(skill) {
  const li = document.createElement('li');
  li.className = 'skill';
  li.innerHTML = `
    <p class="skill-name"></p>
    <p class="skill-meta"></p>
    <div class="skill-actions">
      <button class="run">Run ▶</button>
      <button class="rename">Rename</button>
      <button class="export">Export</button>
      <button class="del">Delete</button>
    </div>`;
  li.querySelector('.skill-name').textContent = skill.name;
  li.querySelector('.skill-meta').textContent =
    `${skill.steps.length} steps · runs ${skill.stats.runs} · heals ${skill.stats.heals} · last ${fmtTime(skill.stats.lastRunAt)}`;

  li.querySelector('.run').addEventListener('click', () => runSkill(skill));
  li.querySelector('.rename').addEventListener('click', () => renameSkill(skill));
  li.querySelector('.export').addEventListener('click', async () => {
    download(`${skill.name.replace(/[^\w-]+/g, '_')}.json`, await store.exportSkill(skill.id));
  });
  li.querySelector('.del').addEventListener('click', () => deleteSkill(skill));
  return li;
}

async function render() {
  const skills = await store.list();
  els.list.replaceChildren(...skills.map(skillRow));
  els.empty.hidden = skills.length > 0;
}

async function runSkill(skill) {
  const tab = await getActiveTab();
  if (!tab) return setStatus('No active tab.', 'err');
  if (!(await ensureContent(tab.id))) {
    return setStatus('Open a normal web page (http/https) and try again.', 'err');
  }

  const params = {};
  for (const p of skill.params || []) {
    const v = window.prompt(`${p.label || p.name}:`, p.default ?? '');
    if (v === null) return setStatus('Run cancelled.');
    params[p.name] = v;
  }

  setStatus(`Running "${skill.name}"…`);
  try {
    const result = await sendToTab(tab.id, { type: MSG.REPLAY_SKILL, skill, params });
    if (result?.ok) {
      await store.recordRun(skill.id, { healed: false });
      setStatus(`✓ Ran "${skill.name}" (${result.completed} steps).`, 'ok');
    } else {
      setStatus(`✗ Failed at step ${result?.failedStep} (${result?.reason}).`, 'err');
    }
  } catch (err) {
    setStatus(`✗ ${err.message}`, 'err');
  }
  await render();
}

async function renameSkill(skill) {
  const name = window.prompt('Rename skill:', skill.name);
  if (!name) return;
  await store.rename(skill.id, name);
  await render();
}

async function deleteSkill(skill) {
  if (!window.confirm(`Delete "${skill.name}"?`)) return;
  await store.remove(skill.id);
  await render();
}

async function onLearn() {
  const task = els.task.value.trim();
  if (!task) return setStatus('Describe the task to learn.', 'err');

  const tab = await getActiveTab();
  if (!tab) return setStatus('No active tab.', 'err');
  if (!(await ensureContent(tab.id))) {
    return setStatus('Open a normal web page (http/https) and try again.', 'err');
  }

  const llmConfig = await loadLLMConfig();
  if (!llmConfig.baseURL || !llmConfig.model) {
    return setStatus('Set your model endpoint in Settings first.', 'err');
  }

  els.learn.disabled = true;
  setStatus('Learning… watching the agent work.');
  try {
    const result = await learnViaTab(task, tab.id, llmConfig, {
      onStep: ({ i, action, ok }) => setStatus(`Step ${i + 1}: ${action.action}${ok ? '' : ' (retry)'}…`),
    });

    if (result.recorder.length === 0) {
      setStatus(`Nothing was recorded (${result.reason}).`, 'err');
    } else {
      const skill = result.recorder.toSkill({ name: els.name.value.trim() || task });
      await store.create(skill);
      setStatus(`✓ Learned "${skill.name}" (${skill.steps.length} steps). ${result.ok ? '' : `(stopped: ${result.reason})`}`, 'ok');
      els.task.value = '';
      els.name.value = '';
      await render();
    }
  } catch (err) {
    setStatus(`✗ ${err.message}`, 'err');
  } finally {
    els.learn.disabled = false;
  }
}

async function onImport(file) {
  try {
    const text = await file.text();
    const count = await store.importSkills(text);
    setStatus(`Imported ${count} skill(s).`, 'ok');
    await render();
  } catch (err) {
    setStatus(`Import failed: ${err.message}`, 'err');
  }
}

els.learn.addEventListener('click', onLearn);
els.settings.addEventListener('click', () => chrome.runtime.openOptionsPage());
els.exportAll.addEventListener('click', async () => download('javis-skills.json', await store.exportAll()));
els.importBtn.addEventListener('click', () => els.importFile.click());
els.importFile.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) onImport(file);
  e.target.value = '';
});

render();
