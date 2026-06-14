import { describe, it, expect, beforeEach } from 'vitest';
import {
  SkillStore,
  makeSkill,
  createMemoryAdapter,
  createChromeAdapter,
  STORAGE_KEY,
} from '../src/core/skill-store.js';

// Deterministic, monotonic clock for stable timestamps in assertions.
function makeClock(start = 1000) {
  let t = start;
  return () => (t += 1);
}

const sampleSteps = [{ action: 'click', selector: { candidates: [{ type: 'css', value: '#b', score: 40 }] } }];

let store;
beforeEach(() => {
  store = new SkillStore(createMemoryAdapter(), { now: makeClock() });
});

describe('makeSkill', () => {
  it('fills defaults and an id', () => {
    const s = makeSkill({ name: 'Test' }, () => 5);
    expect(s.id).toBeTruthy();
    expect(s.name).toBe('Test');
    expect(s.steps).toEqual([]);
    expect(s.createdAt).toBe(5);
    expect(s.stats).toEqual({ runs: 0, heals: 0, lastRunAt: null });
  });
});

describe('SkillStore CRUD', () => {
  it('creates and lists skills (newest first)', async () => {
    const a = await store.create({ name: 'A', steps: sampleSteps });
    const b = await store.create({ name: 'B', steps: sampleSteps });
    const list = await store.list();
    expect(list.map((s) => s.name)).toEqual(['B', 'A']);
    expect(a.id).not.toBe(b.id);
  });

  it('gets by id and returns null for unknown', async () => {
    const a = await store.create({ name: 'A', steps: sampleSteps });
    expect((await store.get(a.id)).name).toBe('A');
    expect(await store.get('nope')).toBe(null);
  });

  it('updates and bumps updatedAt; throws on unknown id', async () => {
    const a = await store.create({ name: 'A', steps: sampleSteps });
    const updated = await store.update(a.id, { description: 'desc' });
    expect(updated.description).toBe('desc');
    expect(updated.updatedAt).toBeGreaterThan(a.updatedAt);
    expect(updated.id).toBe(a.id);
    await expect(store.update('nope', {})).rejects.toThrow();
  });

  it('renames', async () => {
    const a = await store.create({ name: 'A', steps: sampleSteps });
    const r = await store.rename(a.id, 'Renamed');
    expect(r.name).toBe('Renamed');
  });

  it('removes; returns false for unknown', async () => {
    const a = await store.create({ name: 'A', steps: sampleSteps });
    expect(await store.remove(a.id)).toBe(true);
    expect(await store.list()).toHaveLength(0);
    expect(await store.remove('nope')).toBe(false);
  });

  it('records runs and heals', async () => {
    const a = await store.create({ name: 'A', steps: sampleSteps });
    await store.recordRun(a.id, { healed: false });
    await store.recordRun(a.id, { healed: true });
    const s = await store.get(a.id);
    expect(s.stats.runs).toBe(2);
    expect(s.stats.heals).toBe(1);
    expect(s.stats.lastRunAt).toBeGreaterThan(0);
  });

  it('clears all', async () => {
    await store.create({ name: 'A', steps: sampleSteps });
    await store.clear();
    expect(await store.list()).toHaveLength(0);
  });
});

describe('export / import', () => {
  it('round-trips a single skill with a new id (no clobber)', async () => {
    const a = await store.create({ name: 'A', steps: sampleSteps });
    const json = await store.exportSkill(a.id);
    const count = await store.importSkills(json);
    expect(count).toBe(1);
    const list = await store.list();
    expect(list).toHaveLength(2);
    const ids = list.map((s) => s.id);
    expect(new Set(ids).size).toBe(2); // imported copy got a fresh id
  });

  it('exports all and imports into another store', async () => {
    await store.create({ name: 'A', steps: sampleSteps });
    await store.create({ name: 'B', steps: sampleSteps });
    const json = await store.exportAll();

    const other = new SkillStore(createMemoryAdapter(), { now: makeClock() });
    const count = await other.importSkills(json);
    expect(count).toBe(2);
    expect((await other.list()).map((s) => s.name).sort()).toEqual(['A', 'B']);
  });

  it('preserves ids when regenerateIds is false', async () => {
    const a = await store.create({ name: 'A', steps: sampleSteps });
    const json = await store.exportSkill(a.id);
    const other = new SkillStore(createMemoryAdapter(), { now: makeClock() });
    await other.importSkills(json, { regenerateIds: false });
    expect((await other.get(a.id)).name).toBe('A');
  });

  it('rejects malformed import data', async () => {
    await expect(store.importSkills('{"foo":1}')).rejects.toThrow();
  });

  it('skips entries without a steps array', async () => {
    const count = await store.importSkills({ skills: [{ name: 'bad' }, { name: 'ok', steps: sampleSteps }] });
    expect(count).toBe(1);
  });
});

describe('persistence across store instances', () => {
  it('shares data through a common adapter', async () => {
    const adapter = createMemoryAdapter();
    const s1 = new SkillStore(adapter, { now: makeClock() });
    await s1.create({ name: 'Persisted', steps: sampleSteps });
    const s2 = new SkillStore(adapter, { now: makeClock() });
    expect((await s2.list())[0].name).toBe('Persisted');
  });
});

describe('createChromeAdapter', () => {
  it('reads and writes through a chrome.storage-like area', async () => {
    const backing = {};
    const fakeArea = {
      async get(key) { return key in backing ? { [key]: backing[key] } : {}; },
      async set(obj) { Object.assign(backing, obj); },
    };
    const adapter = createChromeAdapter(fakeArea);
    const s = new SkillStore(adapter, { now: makeClock() });
    await s.create({ name: 'Chrome', steps: sampleSteps });
    expect(backing[STORAGE_KEY]).toHaveLength(1);
    expect(backing[STORAGE_KEY][0].name).toBe('Chrome');
  });
});
