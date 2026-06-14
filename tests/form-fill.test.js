import { describe, it, expect, beforeEach } from 'vitest';
import { serializeForm } from '../src/core/dom-serializer.js';
import {
  buildFillPrompt,
  coerceValue,
  parseFillPlan,
  describePlan,
  applyFill,
  fillForm,
} from '../src/core/form-fill.js';

const FORM = `
  <form>
    <label>Full name <input name="name" type="text"></label>
    <label for="em">Email</label><input id="em" name="email" type="email">
    <select name="country"><option>USA</option><option>Canada</option></select>
    <label><input type="checkbox" name="news"> Subscribe</label>
    <fieldset><legend>Gender</legend>
      <label><input type="radio" name="g" value="m"> Male</label>
      <label><input type="radio" name="g" value="f"> Female</label>
    </fieldset>
    <textarea name="bio"></textarea>
    <input type="hidden" name="csrf">
    <input type="submit" value="Go">
    <input type="file" name="cv">
    <input type="text" name="dis" disabled>
  </form>`;

const setForm = () => { document.body.innerHTML = FORM; };
beforeEach(() => { document.body.innerHTML = ''; });

describe('serializeForm', () => {
  it('captures fillable fields and skips non-fillable ones', () => {
    setForm();
    const { fields } = serializeForm(document);
    expect(fields.map((f) => f.type)).toEqual(['text', 'email', 'select', 'checkbox', 'radio', 'textarea']);
  });

  it('extracts labels, options and radio grouping', () => {
    setForm();
    const { fields, map } = serializeForm(document);
    expect(fields[0].label).toBe('Full name');
    expect(fields[1].label).toBe('Email');
    expect(fields[2].options).toEqual(['USA', 'Canada']);
    expect(fields[4].type).toBe('radio');
    expect(fields[4].label).toBe('Gender');
    expect(fields[4].options).toEqual(['Male', 'Female']);
    expect(map.get(4).kind).toBe('radio');
    expect(map.get(4).options).toHaveLength(2);
  });
});

describe('coerceValue', () => {
  it('coerces checkbox values to boolean', () => {
    expect(coerceValue({ type: 'checkbox' }, 'yes')).toBe(true);
    expect(coerceValue({ type: 'checkbox' }, false)).toBe(false);
    expect(coerceValue({ type: 'checkbox' }, true)).toBe(true);
  });
  it('matches select/radio options (case-insensitive) or skips', () => {
    const f = { type: 'select', options: ['USA', 'Canada'] };
    expect(coerceValue(f, 'canada')).toBe('Canada');
    expect(coerceValue(f, 'Mexico')).toBeUndefined();
  });
  it('never fills passwords', () => {
    expect(coerceValue({ type: 'password' }, 'hunter2')).toBeUndefined();
  });
  it('validates email', () => {
    expect(coerceValue({ type: 'email' }, 'bad')).toBeUndefined();
    expect(coerceValue({ type: 'email' }, 'a@b.com')).toBe('a@b.com');
  });
});

describe('parseFillPlan', () => {
  it('keeps valid fills, drops unknown indices and unmatched values', () => {
    setForm();
    const { fields } = serializeForm(document);
    const plan = parseFillPlan(
      { fills: [
        { index: 0, value: 'Arthur' },
        { index: 2, value: 'Mexico' }, // not an option -> dropped
        { index: 99, value: 'x' }, // unknown -> dropped
        { index: 3, value: 'yes' }, // checkbox -> true
      ] },
      fields,
    );
    expect(plan).toEqual([
      { index: 0, value: 'Arthur' },
      { index: 3, value: true },
    ]);
  });
});

describe('applyFill', () => {
  it('fills text, select, checkbox, radio and fires events', () => {
    setForm();
    const { fields, map } = serializeForm(document);
    let changes = 0;
    document.querySelector('[name="name"]').addEventListener('input', () => { changes += 1; });

    const plan = parseFillPlan(
      { fills: [
        { index: 0, value: 'Arthur' },
        { index: 1, value: 'a@b.com' },
        { index: 2, value: 'Canada' },
        { index: 3, value: true },
        { index: 4, value: 'Female' },
        { index: 5, value: 'hello' },
      ] },
      fields,
    );
    const res = applyFill(plan, map);

    expect(res.applied).toBe(6);
    expect(document.querySelector('[name="name"]').value).toBe('Arthur');
    expect(document.querySelector('[name="email"]').value).toBe('a@b.com');
    expect(document.querySelector('[name="country"]').value).toBe('Canada');
    expect(document.querySelector('[name="news"]').checked).toBe(true);
    expect(document.querySelector('input[value="f"]').checked).toBe(true);
    expect(document.querySelector('[name="bio"]').value).toBe('hello');
    expect(changes).toBe(1);
  });

  it('skips a radio field whose options left the DOM', () => {
    setForm();
    const { map } = serializeForm(document);
    document.querySelector('fieldset').remove(); // detach the radio group
    const res = applyFill([{ index: 4, value: 'Female' }], map);
    expect(res.applied).toBe(0);
    expect(res.failed).toBe(1);
  });
});

describe('describePlan', () => {
  it('produces human-readable rows', () => {
    setForm();
    const { fields } = serializeForm(document);
    const rows = describePlan([{ index: 0, value: 'Arthur' }], fields);
    expect(rows).toEqual([{ index: 0, label: 'Full name', value: 'Arthur' }]);
  });
});

describe('fillForm (scripted LLM)', () => {
  const profile = { fullName: 'Arthur Wang', email: 'arthur@example.com', subscribe: false };

  it('maps a profile to the form and applies it', async () => {
    setForm();
    const llm = async () => ({ fills: [
      { index: 0, value: 'Arthur Wang' },
      { index: 1, value: 'arthur@example.com' },
      { index: 4, value: 'Male' },
    ] });
    const res = await fillForm(document, profile, { llm });
    expect(res.applied).toBe(3);
    expect(document.querySelector('[name="name"]').value).toBe('Arthur Wang');
    expect(document.querySelector('input[value="m"]').checked).toBe(true);
  });

  it('dryRun returns a preview without touching the DOM', async () => {
    setForm();
    const llm = async () => ({ fills: [{ index: 0, value: 'Arthur Wang' }] });
    const res = await fillForm(document, profile, { llm, dryRun: true });
    expect(res.preview).toEqual([{ index: 0, label: 'Full name', value: 'Arthur Wang' }]);
    expect(document.querySelector('[name="name"]').value).toBe('');
  });

  it('reports no-fields on a page without a form', async () => {
    document.body.innerHTML = '<p>nothing here</p>';
    const res = await fillForm(document, profile, { llm: async () => ({ fills: [] }) });
    expect(res.reason).toBe('no-fields');
  });
});
