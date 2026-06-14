// Shared action vocabulary for frozen skills.
//
// A skill is an ordered list of steps; each step has an `action` from this set.
// DOM actions operate on an element resolved via a SelectorBundle. Host actions
// are extension-level (tabs/navigation) and are delegated to an injected host
// so the replay engine itself stays pure and testable.

export const ACTIONS = Object.freeze({
  NAVIGATE: 'navigate',
  CLICK: 'click',
  INPUT: 'input',
  SELECT: 'select',
  SCROLL: 'scroll',
  WAIT_FOR: 'waitFor',
  OPEN_TAB: 'openTab',
  CLOSE_TAB: 'closeTab',
  SWITCH_TAB: 'switchTab',
});

/** Actions that require a resolved DOM element. */
export const DOM_ACTIONS = new Set([
  ACTIONS.CLICK,
  ACTIONS.INPUT,
  ACTIONS.SELECT,
  ACTIONS.SCROLL,
]);

/** Actions delegated to the extension host (tabs/navigation). */
export const HOST_ACTIONS = new Set([
  ACTIONS.NAVIGATE,
  ACTIONS.OPEN_TAB,
  ACTIONS.CLOSE_TAB,
  ACTIONS.SWITCH_TAB,
]);

export const WAIT_TYPES = Object.freeze({
  NONE: 'none',
  LOAD: 'load',
  ELEMENT: 'element',
  GONE: 'gone',
  DELAY: 'delay',
});
