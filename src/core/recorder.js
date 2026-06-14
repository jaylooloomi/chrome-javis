// Recorder / Freeze layer.
//
// Turns the actions of a successful learn run into a frozen skill. The critical
// job (per the research) is the *freeze translation*: at the moment an action
// succeeds, capture the live element and compute a stable SelectorBundle for it
// — never persist a volatile runtime index. The recorder accumulates
// declarative steps and emits a skill ready for the Skill Store.

import { computeSelectorBundle } from './selector-engine.js';
import { ACTIONS, DOM_ACTIONS, HOST_ACTIONS } from '../shared/actions.js';

export class SkillRecorder {
  constructor() {
    this.steps = [];
    this.params = [];
    this.startUrl = '';
  }

  get length() {
    return this.steps.length;
  }

  reset() {
    this.steps = [];
    this.params = [];
    this.startUrl = '';
  }

  /**
   * Record one step. DOM actions freeze a SelectorBundle for `element`; host
   * actions carry a url/value; waitFor carries only a wait condition.
   */
  recordStep({ action, element, value, url, wait }) {
    if (DOM_ACTIONS.has(action)) {
      if (!element || element.nodeType !== 1) {
        throw new Error(`recordStep: action '${action}' requires a DOM element`);
      }
      const step = { action, selector: computeSelectorBundle(element) };
      if (value !== undefined && value !== null && value !== '') step.value = value;
      if (wait) step.wait = wait;
      this.steps.push(step);
      return step;
    }

    if (HOST_ACTIONS.has(action)) {
      const step = { action };
      const v = url ?? value;
      if (v != null) step.value = v;
      if (wait) step.wait = wait;
      this.steps.push(step);
      return step;
    }

    if (action === ACTIONS.WAIT_FOR) {
      const step = { action: ACTIONS.WAIT_FOR, wait: wait || { type: 'none' } };
      this.steps.push(step);
      return step;
    }

    throw new Error(`recordStep: unknown action '${action}'`);
  }

  // --- convenience wrappers ------------------------------------------------

  recordNavigate(url, wait = { type: 'load' }) {
    if (!this.startUrl) this.startUrl = url;
    return this.recordStep({ action: ACTIONS.NAVIGATE, url, wait });
  }

  recordClick(element, wait) {
    return this.recordStep({ action: ACTIONS.CLICK, element, wait });
  }

  recordInput(element, value, wait) {
    return this.recordStep({ action: ACTIONS.INPUT, element, value, wait });
  }

  recordSelect(element, value, wait) {
    return this.recordStep({ action: ACTIONS.SELECT, element, value, wait });
  }

  recordScroll(element, wait) {
    return this.recordStep({ action: ACTIONS.SCROLL, element, wait });
  }

  /**
   * Turn captured literal values into reusable parameters. Each mapping is
   * { value, name, label?, default? }: every step whose value equals `value`
   * is rewritten to "{{name}}" and a param descriptor is added.
   *
   * @returns {Array} the param descriptors that were applied
   */
  parameterize(mappings = []) {
    const applied = [];
    for (const m of mappings) {
      if (!m || !m.name || m.value === undefined) continue;
      let used = false;
      for (const step of this.steps) {
        if (typeof step.value === 'string' && step.value === m.value) {
          step.value = `{{${m.name}}}`;
          used = true;
        }
      }
      if (used) {
        const descriptor = { name: m.name, label: m.label || m.name, default: m.default ?? m.value };
        this.params.push(descriptor);
        applied.push(descriptor);
      }
    }
    return applied;
  }

  /** Emit a skill object (shape consumed by SkillStore.create). */
  toSkill({ name, description, params } = {}) {
    return {
      name: name || 'Recorded skill',
      description: description || '',
      startUrl: this.startUrl,
      params: params || this.params,
      steps: this.steps.map((s) => ({ ...s })),
    };
  }
}
