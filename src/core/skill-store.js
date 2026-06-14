// Skill Store — persistence for frozen skills.
//
// CRUD + export/import over a pluggable storage adapter. The adapter owns
// where the skill list lives; the store owns the schema and operations. This
// keeps the store pure and unit-testable (memory adapter) while wiring cleanly
// to chrome.storage.local in the extension.

export const STORAGE_KEY = 'javis.skills';

/** Generate a UUID, degrading gracefully if crypto APIs are limited. */
function uuid() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (c && typeof c.getRandomValues === 'function') {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'));
    return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`;
  }
  return `id-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** Build a complete skill object from a partial, filling defaults. */
export function makeSkill(partial = {}, now = Date.now) {
  const ts = now();
  return {
    id: partial.id || uuid(),
    name: partial.name || 'Untitled skill',
    description: partial.description || '',
    startUrl: partial.startUrl || '',
    params: Array.isArray(partial.params) ? partial.params : [],
    steps: Array.isArray(partial.steps) ? partial.steps : [],
    createdAt: partial.createdAt || ts,
    updatedAt: partial.updatedAt || ts,
    stats: {
      runs: partial.stats?.runs ?? 0,
      heals: partial.stats?.heals ?? 0,
      lastRunAt: partial.stats?.lastRunAt ?? null,
    },
  };
}

/** In-memory adapter (tests, or a non-persistent fallback). */
export function createMemoryAdapter(initial = []) {
  let data = initial.map((s) => ({ ...s }));
  return {
    async load() {
      return data.map((s) => ({ ...s }));
    },
    async save(skills) {
      data = skills.map((s) => ({ ...s }));
    },
  };
}

/** chrome.storage.local adapter. */
export function createChromeAdapter(area) {
  const storage = area || globalThis.chrome?.storage?.local;
  if (!storage) throw new Error('createChromeAdapter: chrome.storage.local unavailable');
  return {
    async load() {
      const result = await storage.get(STORAGE_KEY);
      const value = result?.[STORAGE_KEY];
      return Array.isArray(value) ? value : [];
    },
    async save(skills) {
      await storage.set({ [STORAGE_KEY]: skills });
    },
  };
}

export class SkillStore {
  constructor(adapter, { now = Date.now } = {}) {
    if (!adapter) throw new Error('SkillStore requires a storage adapter');
    this.adapter = adapter;
    this.now = now;
  }

  async list() {
    return this.adapter.load();
  }

  async get(id) {
    const skills = await this.adapter.load();
    return skills.find((s) => s.id === id) || null;
  }

  async create(partial) {
    const skills = await this.adapter.load();
    const skill = makeSkill(partial, this.now);
    skills.unshift(skill); // newest first
    await this.adapter.save(skills);
    return skill;
  }

  async update(id, patch) {
    const skills = await this.adapter.load();
    const idx = skills.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error(`SkillStore.update: no skill with id ${id}`);
    const merged = {
      ...skills[idx],
      ...patch,
      id, // id is immutable
      stats: { ...skills[idx].stats, ...(patch.stats || {}) },
      updatedAt: this.now(),
    };
    skills[idx] = merged;
    await this.adapter.save(skills);
    return merged;
  }

  async rename(id, name) {
    return this.update(id, { name });
  }

  async remove(id) {
    const skills = await this.adapter.load();
    const next = skills.filter((s) => s.id !== id);
    if (next.length === skills.length) return false;
    await this.adapter.save(next);
    return true;
  }

  async recordRun(id, { healed = false } = {}) {
    const skill = await this.get(id);
    if (!skill) throw new Error(`SkillStore.recordRun: no skill with id ${id}`);
    return this.update(id, {
      stats: {
        runs: (skill.stats.runs ?? 0) + 1,
        heals: (skill.stats.heals ?? 0) + (healed ? 1 : 0),
        lastRunAt: this.now(),
      },
    });
  }

  async clear() {
    await this.adapter.save([]);
  }

  async exportSkill(id) {
    const skill = await this.get(id);
    if (!skill) throw new Error(`SkillStore.exportSkill: no skill with id ${id}`);
    return JSON.stringify({ version: 1, skills: [skill] }, null, 2);
  }

  async exportAll() {
    const skills = await this.adapter.load();
    return JSON.stringify({ version: 1, skills }, null, 2);
  }

  /**
   * Import skills from an export string. Accepts an array, a single skill, or
   * a { skills: [...] } envelope. New ids are assigned by default so imports
   * never clobber existing skills.
   *
   * @returns {Promise<number>} count imported
   */
  async importSkills(json, { regenerateIds = true } = {}) {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    let incoming;
    if (Array.isArray(parsed)) incoming = parsed;
    else if (Array.isArray(parsed?.skills)) incoming = parsed.skills;
    else if (parsed && parsed.steps) incoming = [parsed];
    else throw new Error('importSkills: unrecognized format');

    const valid = incoming.filter((s) => s && Array.isArray(s.steps));
    if (valid.length === 0) return 0;

    const skills = await this.adapter.load();
    for (const raw of valid) {
      const skill = makeSkill({ ...raw, id: regenerateIds ? undefined : raw.id }, this.now);
      skills.unshift(skill);
    }
    await this.adapter.save(skills);
    return valid.length;
  }
}
