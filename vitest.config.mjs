import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Core engines manipulate the DOM, so default to a jsdom environment.
    environment: 'jsdom',
    include: ['tests/**/*.test.{js,mjs}'],
    globals: false,
  },
});
