import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // 1. Navigate to home (redirects to login)
  await page.goto('/');

  // 2. Fill login form
  await page.getByLabel('EMAIL').fill('sandra@supermom.io');
  await page.getByLabel('PASSWORD').fill('TestPass2026!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // 3. Wait for redirect/loading
  await expect(page).not.toHaveURL(/.*login.*/);

  // 4. Handle Onboarding if it appears
  const onboardingBtn = page.getByRole('button', { name: 'Start the mission' });
  if (await onboardingBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await onboardingBtn.click();
    await page.getByRole('button', { name: 'Sounds good' }).click();
    await page.getByRole('button', { name: "Let's Go!" }).click();
    await expect(page.getByText('Your AI Sidekick')).not.toBeVisible();
    // Also set flags as backup
    await page.evaluate(() => {
       localStorage.setItem('sm_onboarding_complete', 'true');
       window.__SKIP_ONBOARDING = true;
    });
  }

  // 5. Verify we are on home page
  await expect(page.getByText('Today', { exact: true })).toBeVisible();

  // 6. Save storage state
  await page.context().storageState({ path: authFile });
});
