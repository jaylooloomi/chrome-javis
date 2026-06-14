import { describe, it, expect } from 'vitest';

// Verifies the test toolchain + jsdom DOM environment are wired up.
describe('toolchain smoke test', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });

  it('has a jsdom DOM', () => {
    document.body.innerHTML = '<button id="go">Go</button>';
    expect(document.getElementById('go')?.textContent).toBe('Go');
  });
});
