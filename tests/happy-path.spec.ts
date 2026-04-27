import { test, expect } from '@playwright/test';

test.describe('Supermom Happy Path', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__SKIP_ONBOARDING = true;
    });
  });

  test('should book a job, complete it, and view invoice', async ({ page }) => {
    // 1. Navigate to home (already authenticated via setup)
    await page.goto('/');
    await page.waitForTimeout(1000);
    await expect(page.getByText('Today', { exact: true })).toBeVisible();

    // 2. Open New Job Sheet
    await page.getByRole('button', { name: 'Book new job' }).click();
    await page.waitForTimeout(1000);
    
    // Step 1: Who
    const dialog = page.getByRole('dialog', { name: 'Book new job' });
    await expect(dialog).toBeVisible();

    // Click Sarah
    await dialog.getByText('Sarah', { exact: true }).first().click({ force: true });
    await page.waitForTimeout(1500);
    
    // Click Next
    await dialog.getByRole('button', { name: 'Next →' }).click({ force: true });
    await page.waitForTimeout(1500);

    // Step 2: What & When
    await dialog.getByText('Regular', { exact: true }).click({ force: true });
    await page.waitForTimeout(1000);
    await dialog.getByRole('button', { name: 'Next →' }).click({ force: true });
    await page.waitForTimeout(1500);

    // Step 3: Review & Book
    await dialog.getByRole('button', { name: /Book it!/ }).click({ force: true });
    
    // Wait for the booking sheet to close completely
    await page.waitForTimeout(3000);

    // 3. Verify job appears on Home
    await expect(page.getByText(/Sarah Connor/i).first()).toBeVisible();

    // 4. Complete the job
    console.log('Clicking job card for Sarah Connor...');
    
    // Find the text "Sarah Connor" and click its parent card
    const sarahCard = page.locator('div').filter({ hasText: /Sarah Connor/i }).last();
    await sarahCard.click({ force: true });
    
    await page.waitForTimeout(2000);
    
    const detailDialog = page.getByRole('dialog', { name: 'Job details' });
    await expect(detailDialog).toBeVisible();
    
    // Click Mark Paid to open the PostJobSheet
    await detailDialog.getByRole('button', { name: 'Mark Paid' }).click({ force: true });
    await page.waitForTimeout(2000);

    // 5. Log Payment
    const postJobDialog = page.getByRole('dialog', { name: 'Complete job' });
    await expect(postJobDialog).toBeVisible();
    await postJobDialog.getByRole('button', { name: /Log Payment/ }).click({ force: true });
    await page.waitForTimeout(2500);

    // 6. View Invoice
    const [newPage] = await Promise.all([
      page.waitForEvent('popup'),
      postJobDialog.getByRole('button', { name: 'VIEW' }).click({ force: true })
    ]);

    // 7. Verify we are on the invoice page
    await expect(newPage).toHaveURL(/\/i\/.*/);
    await expect(newPage.getByText('TOTAL', { exact: true })).toBeVisible();
  });

  test('service list is populated in edit mode', async ({ page }) => {
    await page.goto('/');
    // Click the first job card client name to open details
    await page.locator('div[onClick]').filter({ hasText: 'Client' }).first().click(); 
    await page.click('text=Edit Job');
    // Check if select options are populated
    const options = await page.locator('select >> option').allTextContents();
    // options[0] is usually "— select —", so we expect more than 1
    expect(options.length).toBeGreaterThan(1); 
  });
});
