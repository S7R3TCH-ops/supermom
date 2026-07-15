import { test, expect } from '@playwright/test';

test.describe('QA Regression Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__SKIP_ONBOARDING = true;
    });
    // Set a fixed viewport for consistent mobile-like testing
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForTimeout(2000); // Wait for initial data load
  });

  test('Job Editing Validation: Red-box error on empty fields', async ({ page }) => {
    // 1. Setup: Book a job quickly
    await page.getByRole('button', { name: 'Book new job' }).click();
    const dialog = page.getByRole('dialog', { name: 'Book new job' });
    await dialog.locator('button').filter({ hasText: /@/ }).first().click({ force: true });
    await page.waitForTimeout(1000);
    await dialog.getByRole('button', { name: 'Next →' }).click({ force: true });
    await dialog.locator('button').filter({ hasText: /\$|\/hr/ }).first().click({ force: true });
    await dialog.getByRole('button', { name: 'Next →' }).click({ force: true });
    await dialog.getByRole('button', { name: /Book it!/ }).click({ force: true });
    await page.waitForTimeout(2500);

    // 2. Open Job Detail Sheet
    const jobCard = page.locator('div[style*="cursor: pointer"]').first();
    await jobCard.click({ force: true });
    await page.waitForTimeout(1000);

    const detailDialog = page.getByRole('dialog', { name: 'Job details' });
    await detailDialog.getByRole('button', { name: 'Edit Job' }).click({ force: true });
    await page.waitForTimeout(1000);

    // 3. Clear required fields to trigger validation
    // Clear Date
    await detailDialog.getByLabel('DATE').fill('');
    // Attempt to save
    await detailDialog.getByRole('button', { name: 'Save Changes' }).click({ force: true });

    // 4. Verify red-box validation error appears
    const errorBox = detailDialog.getByText(/Validation Error/i);
    await expect(errorBox).toBeVisible();
    await expect(detailDialog.getByText(/Date is required/i)).toBeVisible();

    // Fill date back and clear time
    const today = new Date().toISOString().split('T')[0];
    await detailDialog.getByLabel('DATE').fill(today);
    await detailDialog.getByLabel('START TIME').fill('');
    await detailDialog.getByRole('button', { name: 'Save Changes' }).click({ force: true });

    await expect(errorBox).toBeVisible();
    await expect(detailDialog.getByText(/Time is required/i)).toBeVisible();

    // Close dialog
    await detailDialog.getByRole('button', { name: 'Cancel' }).click({ force: true });
  });

  test('Future-dated job completion flow (No freeze/crash)', async ({ page }) => {
    // 1. Setup: Book a job for tomorrow
    await page.getByRole('button', { name: 'Book new job' }).click();
    const dialog = page.getByRole('dialog', { name: 'Book new job' });
    
    // Step 1: Who
    await dialog.locator('button').filter({ hasText: /@/ }).first().click({ force: true });
    await page.waitForTimeout(1000);
    await dialog.getByRole('button', { name: 'Next →' }).click({ force: true });

    // Step 2: What & When
    await dialog.locator('button').filter({ hasText: /\$|\/hr/ }).first().click({ force: true });
    
    // Set date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await dialog.getByLabel('Date').fill(dateStr);
    
    await dialog.getByRole('button', { name: 'Next →' }).click({ force: true });

    // Step 3: Book
    await dialog.getByRole('button', { name: /Book it!/ }).click({ force: true });
    await page.waitForTimeout(2500);

    // Navigate to next week/day to find the job if it's tomorrow
    await page.getByRole('button', { name: 'Next week' }).click().catch(() => {});
    await page.waitForTimeout(1000);

    // 2. Open Job Detail Sheet
    const jobCard = page.locator('div[style*="cursor: pointer"]').first();
    await jobCard.click({ force: true });
    await page.waitForTimeout(1000);

    const detailDialog = page.getByRole('dialog', { name: 'Job details' });
    
    // 3. Click Mark Complete
    await detailDialog.getByRole('button', { name: 'Mark Complete' }).click({ force: true });
    await page.waitForTimeout(1000);

    // 4. Verify custom future-dated confirmation appears in JobDetailSheet
    await expect(detailDialog.getByText(/mark it complete anyway\?/i)).toBeVisible();
    
    // Click Yes, continue
    await detailDialog.getByRole('button', { name: 'Yes, continue' }).click({ force: true });
    await page.waitForTimeout(1500);

    // 5. PostJobSheet should open
    const postJobDialog = page.getByRole('dialog', { name: 'Complete job' });
    await expect(postJobDialog).toBeVisible();

    // Set page handler to catch window.confirm if it appears (it shouldn't, but just in case)
    let dialogAppeared = false;
    page.once('dialog', async dialog => {
      dialogAppeared = true;
      await dialog.accept();
    });

    // 6. Click Save & Log Paid
    await postJobDialog.getByRole('button', { name: /Save & Log Paid/ }).click({ force: true });
    await page.waitForTimeout(3000);

    // Verify window.confirm native dialog did NOT appear (regression test)
    expect(dialogAppeared).toBe(false);

    // 7. Verify the PostJobSheet closed and job is completed
    await expect(postJobDialog).toBeHidden();
  });
});
