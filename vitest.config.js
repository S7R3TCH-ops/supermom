import { defineConfig } from 'vitest/config';

// Unit tests only (src/**/*.test.*, api/**/*.test.*). Playwright E2E specs live
// in tests/*.spec.ts and run via their own runner — the include below keeps
// Vitest away from them. Standalone config (not merged with vite.config.js) so
// the PWA/react plugins don't run for pure-logic tests.
// api/**/*.test.* added 2026-09-18 (lockscreen push) for api/_lib/pushAlerts.js —
// the first api/_lib pure-logic module to get unit coverage; existing api/_lib
// files (invoicePdf.ts) are covered indirectly via src/lib/invoicePdfRender.test.js.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,ts}', 'api/**/*.test.{js,ts}'],
  },
});
