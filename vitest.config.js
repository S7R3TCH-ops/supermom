import { defineConfig } from 'vitest/config';

// Unit tests only (src/**/*.test.*). Playwright E2E specs live in tests/*.spec.ts
// and run via their own runner — the include below keeps Vitest away from them.
// Standalone config (not merged with vite.config.js) so the PWA/react plugins
// don't run for pure-logic tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,ts}'],
  },
});
