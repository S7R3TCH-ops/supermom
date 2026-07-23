import { test as setup, expect } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const authFile = 'playwright/.auth/superadmin.json';

setup('authenticate as superadmin', async ({ page }) => {
  // 1. Navigate to home (redirects to login)
  await page.goto('/');

  // 2. Fill login form
  const email = process.env.SUPERADMIN_EMAIL || 'jlundie@gmail.com';
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!password) {
    throw new Error('SUPERADMIN_PASSWORD env var is required (no hardcoded fallback — set it in .env)');
  }
  
  await page.getByLabel('EMAIL').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // 3. Check for errors or wait for redirect
  const errorAlert = page.getByRole('alert');
  if (await errorAlert.isVisible({ timeout: 5000 }).catch(() => false)) {
    const msg = await errorAlert.innerText();
    throw new Error(`Login failed for Super Admin ${email}: ${msg}`);
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
  await expect(page.getByText('Today')).toBeVisible();

  // 6. Save storage state
  await page.context().storageState({ path: authFile });
});
