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
    await page.waitForTimeout(2000); // Wait for initial data load
    await expect(page.getByText('Today')).toBeVisible();

    // Expand bottom navigation menu by clicking the center "+" button
    await page.getByRole('button', { name: 'Add or search' }).click();
    await page.waitForTimeout(600); // Wait for expand animation
    // Click "+ New Job" inside the menu
    await page.getByRole('button', { name: '+ New Job' }).click();
    await page.waitForTimeout(1000);
    
    // Step 1: Who
    const dialog = page.getByRole('dialog', { name: 'Book a mission' }).last();
    await expect(dialog).toBeVisible();

    // Click First Client (or Sarah if she exists)
    let pickedClient = "Sarah Connor";
    const clientBtn = dialog.locator('button').filter({ hasText: /Sarah/i });
    if (await clientBtn.count() > 0) {
      await clientBtn.first().click({ force: true });
    } else {
      const firstClientBtn = dialog.locator('button').filter({ hasText: /Maria/i }).first();
      const text = await firstClientBtn.innerText();
      pickedClient = text.split('\n')[0].trim(); // Assuming name is first line
      await firstClientBtn.click({ force: true });
    }
    await page.waitForTimeout(1000);
    
    // Step 2: What & When - Click the first service button
    await dialog.locator('button').filter({ hasText: /\$|\/hr/ }).first().click({ force: true });
    await page.waitForTimeout(600);

    // Set start time using the wheel time picker
    await dialog.getByRole('button', { name: 'Set' }).first().click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Done' }).click();
    await page.waitForTimeout(600);

    await dialog.getByRole('button', { name: /Next/i }).click({ force: true });
    await page.waitForTimeout(1500);

    // Step 3: Review & Book
    const pastCheckbox = dialog.getByRole('checkbox', { name: /Yes, I know/i });
    const conflictCheckbox = dialog.getByRole('checkbox', { name: /schedule/i });
    for (let i = 0; i < 6; i++) {
      if (await pastCheckbox.isVisible().catch(() => false)) {
        await pastCheckbox.check({ force: true });
      }
      if (await conflictCheckbox.isVisible().catch(() => false)) {
        await conflictCheckbox.check({ force: true });
      }
      await page.waitForTimeout(300);
    }

    await dialog.getByRole('button', { name: /Confirm Booking/ }).click({ force: true });
    
    // Wait for the booking sheet to close completely
    await page.waitForTimeout(3000);

    // 3. Verify job appears on Home
    const clientRegex = new RegExp(pickedClient, 'i');
    await expect(page.getByText(clientRegex).first()).toBeVisible();

    // 4. Complete the job
    console.log(`Clicking job card for ${pickedClient}...`);
    
    // Find the text and click its parent card
    const jobCard = page.locator('div').filter({ hasText: clientRegex }).last();
    await jobCard.click({ force: true });
    
    await page.waitForTimeout(2000);
    
    const detailDialog = page.getByRole('dialog', { name: /job details/i });
    await expect(detailDialog).toBeVisible();
    
    // Click Mark Paid to open the PostJobSheet
    await detailDialog.getByRole('button', { name: 'Mark Paid' }).click({ force: true });
    await page.waitForTimeout(2000);

    // 5. Log Payment
    const postJobDialog = page.getByRole('dialog', { name: 'Complete job' });
    await expect(postJobDialog).toBeVisible();
    await postJobDialog.getByRole('button', { name: /Log Payment|Save & Log Paid/ }).click({ force: true });
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
    await page.waitForTimeout(2000);
    // Click the first job card client name to open details
    await page.locator('div[onClick]').filter({ hasText: 'Client' }).first().click({ force: true }).catch(() => {
        // Fallback: just pick any card
        return page.locator('div[style*="cursor: pointer"]').first().click({ force: true });
    }); 
    await page.click('text=Edit Job');
    // Check if select options are populated
    const options = await page.locator('select >> option').allTextContents();
    // options[0] is usually "— select —", so we expect more than 1
    expect(options.length).toBeGreaterThan(1); 
  });
});
