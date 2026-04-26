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

    // Click Chen
    await dialog.getByText('Chen', { exact: true }).click({ force: true });
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
    await expect(page.getByText(/Chen Family/i).first()).toBeVisible();

    // 4. Complete the job
    console.log('Clicking job card for Chen Family...');
    // Programmatic click on the card that has NEXT UP
    await page.evaluate(() => {
       const els = Array.from(document.querySelectorAll('div, span'));
       const nextUp = els.find(e => e.innerText === 'NEXT UP');
       if (nextUp) {
          // Find parent with onClick
          let curr = nextUp;
          while (curr && !curr.onclick && curr !== document.body) {
             curr = curr.parentElement;
          }
          if (curr && curr.onclick) curr.click();
          else if (nextUp.parentElement) nextUp.parentElement.click();
       }
    });
    
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
});
