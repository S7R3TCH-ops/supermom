import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // 1. Navigate to home (redirects to login)
  await page.goto('/');

  // 2. Fill login form
  // Use Joel's owner account (joel@test.com) — same permissions as Sandra for testing.
  // Sandra's password is unknown; use ADMIN_EMAIL/ADMIN_PASSWORD env vars to override.
  const email = process.env.ADMIN_EMAIL || 'jlundie@gmail.com';
  const password = process.env.ADMIN_PASSWORD || 'TempPass2026!';

  await page.getByLabel('EMAIL').fill(email);
  await page.getByLabel('PASSWORD').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // 3. Check for errors or wait for redirect
  const errorAlert = page.getByRole('alert');
  if (await errorAlert.isVisible({ timeout: 5000 }).catch(() => false)) {
    const msg = await errorAlert.innerText();
    throw new Error(`Login failed for ${email}: ${msg}`);
  }

  await expect(page).not.toHaveURL(/.*login.*/, { timeout: 10000 });
  await page.waitForLoadState('networkidle');

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
