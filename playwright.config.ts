import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60 * 1000,
  expect: {
    timeout: 10000
  },
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: 1,
  /* Opt out of parallel tests on CI. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:8080',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Target mobile viewport as per DESIGN.md */
    viewport: { width: 390, height: 844 },
    timezoneId: 'America/Toronto',
    locale: 'en-CA',
  },

  /* Configure projects for major browsers */
  projects: [
    // channel: 'chrome' uses the system-installed Chrome instead of Playwright's
    // own bundled binary — the bundled download stalls in this sandboxed environment.
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { channel: 'chrome' } },
    { name: 'setup-superadmin', testMatch: /superadmin\.setup\.ts/, use: { channel: 'chrome' } },

    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'superadmin-chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        storageState: 'playwright/.auth/superadmin.json',
      },
      dependencies: ['setup-superadmin'],
    },
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 13'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'Mobile Chrome (Pixel 7)',
      use: {
        ...devices['Pixel 7'],
        channel: 'chrome',
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
  },
});
