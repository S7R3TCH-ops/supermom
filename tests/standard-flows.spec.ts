import { test, expect } from '@playwright/test';

test.describe('Standard Business Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Skip onboarding for all tests
    await page.addInitScript(() => {
      window.__SKIP_ONBOARDING = true;
    });
    // Set a fixed viewport for consistent mobile-like testing
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForTimeout(2000); // Wait for initial data load
  });

  test('Client Management: Add new client and handle duplicates', async ({ page }) => {
    const firstName = `FlowTest_${Math.floor(Math.random() * 10000)}`;
    const lastName = 'User';

    // 1. Add a new client via NewClientSheet
    await page.getByRole('link', { name: 'Clients' }).click();
    await page.getByRole('button', { name: /Add Client/i }).click();

    const dialog = page.getByRole('dialog', { name: 'Add new client' });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('FIRST NAME *').fill(firstName);
    await dialog.getByLabel('LAST NAME').fill(lastName);
    await dialog.getByLabel('PHONE').fill('5551234567');
    await dialog.getByLabel('EMAIL').fill(`${firstName}@example.com`);
    await dialog.getByLabel('STREET').fill('123 Test St');
    await dialog.getByRole('button', { name: 'Save client' }).click();

    // Verify success toast/message and client appearing in list
    await expect(page.getByText(`${firstName} added!`)).toBeVisible();
    
    // Search for the client to make sure they are in the list
    await page.getByPlaceholder(/Search by name/i).fill(firstName);
    await expect(page.getByText(`${firstName} ${lastName}`)).toBeVisible();

    // 2. Attempt to add the same client again (duplicate handling)
    await page.getByRole('button', { name: /Add Client/i }).click();
    await dialog.getByLabel('FIRST NAME *').fill(firstName);
    await dialog.getByLabel('LAST NAME').fill(lastName);
    await dialog.getByLabel('PHONE').fill('5551234567');
    await dialog.getByRole('button', { name: 'Save client' }).click();

    // Verify duplicate validation message appears in the sheet
    // Based on clientsRepo.js: "A client with this name/phone already exists."
    await expect(dialog.getByText(/already exists/i)).toBeVisible();
    
    // Close dialog
    await dialog.getByRole('button', { name: 'Close' }).click();
  });

  test('Job Booking & Conflicts: Overlap detection in Step 2', async ({ page }) => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    // 1. Book first job at 10:00 AM
    await page.getByRole('link', { name: 'Home' }).click();
    await page.getByRole('button', { name: 'Book new job' }).click();
    
    const dialog = page.getByRole('dialog', { name: 'Book new job' });
    await expect(dialog).toBeVisible();

    // Step 1: Who (Pick Sarah)
    await dialog.locator('button').filter({ hasText: /Sarah/i }).first().click({ force: true });
    await page.waitForTimeout(1000);
    await dialog.getByRole('button', { name: 'Next →' }).click({ force: true });

    // Step 2: What & When
    await dialog.locator('button').filter({ hasText: /Regular/i }).first().click({ force: true });
    // Date is usually today by default, but let's be explicit
    await dialog.getByLabel('Date').fill(dateStr);
    await dialog.getByLabel('Time').fill('10:00');
    await dialog.getByRole('button', { name: 'Next →' }).click({ force: true });

    // Step 3: Review & Book
    await dialog.getByRole('button', { name: /Book it!/ }).click({ force: true });
    await page.waitForTimeout(2500);

    // 2. Attempt to book another job that overlaps
    await page.getByRole('button', { name: 'Book new job' }).click();
    await expect(dialog).toBeVisible();

    // Step 1: Who
    await dialog.locator('button').filter({ hasText: /Sarah/i }).first().click({ force: true });
    await page.waitForTimeout(1000);
    await dialog.getByRole('button', { name: 'Next →' }).click({ force: true });

    // Step 2: What & When (Conflict)
    await dialog.locator('button').filter({ hasText: /Regular/i }).first().click({ force: true });
    await dialog.getByLabel('Date').fill(dateStr);
    await dialog.getByLabel('Time').fill('10:30'); // Overlaps with 10:00 (2h duration)

    // Verify amber high-contrast conflict warning
    const conflictWarning = dialog.getByText(/Schedule Conflict/i);
    await expect(conflictWarning).toBeVisible();
    // Verify it mentions the client name (Sarah)
    await expect(dialog.getByText(/Sarah/i)).toBeVisible();

    // Close dialog
    await dialog.getByRole('button', { name: 'Close' }).click();
  });

  test('Job Completion & Payments: Partial and Unpaid flows', async ({ page }) => {
    // 1. Setup: Book a job for "Sarah" today (if not already there)
    await page.getByRole('link', { name: 'Home' }).click();
    const sarahCard = page.locator('div').filter({ hasText: /Sarah/i }).last();
    
    if (!(await sarahCard.isVisible())) {
      // Book one quickly
      await page.getByRole('button', { name: 'Book new job' }).click();
      const dialog = page.getByRole('dialog', { name: 'Book new job' });
      await dialog.locator('button').filter({ hasText: /Sarah/i }).first().click({ force: true });
      await dialog.getByRole('button', { name: 'Next →' }).click({ force: true });
      await dialog.locator('button').filter({ hasText: /Regular/i }).first().click({ force: true });
      await dialog.getByRole('button', { name: 'Next →' }).click({ force: true });
      await dialog.getByRole('button', { name: /Book it!/ }).click({ force: true });
      await page.waitForTimeout(2500);
    }

    // 2. Complete with Partial Payment
    await sarahCard.click({ force: true });
    const detailDialog = page.getByRole('dialog', { name: 'Job details' });
    await detailDialog.getByRole('button', { name: 'Mark Paid' }).click({ force: true });
    
    const postJobDialog = page.getByRole('dialog', { name: 'Complete job' });
    await expect(postJobDialog).toBeVisible();

    // Set a partial amount
    const amountInput = postJobDialog.locator('input[type="number"]').last();
    const totalAmount = await amountInput.inputValue();
    const partialAmount = (parseFloat(totalAmount) / 2).toString();
    await amountInput.fill(partialAmount);
    
    await postJobDialog.getByRole('button', { name: /Save & Log Paid/ }).click({ force: true });
    await page.waitForTimeout(3000); // Wait for success and close

    // Verify UI shows it's still "UNPAID" or "PARTIAL"
    await sarahCard.click({ force: true });
    await expect(page.getByText('Status: Completed')).toBeVisible();
    await expect(page.getByText(/Payment Status: Partial|Payment: Partial/i)).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();


    // 3. Complete another job (or same if we can) as Unpaid
    // Find another scheduled job or book one
    const scheduledCard = page.locator('div').filter({ hasText: /Sarah/i }).filter({ hasText: 'UPCOMING' }).first();
    if (await scheduledCard.isVisible()) {
       await scheduledCard.click({ force: true });
       await detailDialog.getByRole('button', { name: 'Mark Paid' }).click({ force: true });
       await expect(postJobDialog).toBeVisible();
       
       // Click "Not paid yet"
       await postJobDialog.getByRole('button', { name: 'Not paid yet' }).click({ force: true });
       await postJobDialog.getByRole('button', { name: /Save & Close/ }).click({ force: true });
       await page.waitForTimeout(3000);

       // Verify status
       await sarahCard.last().click({ force: true });
       await expect(page.getByText('Status: Completed')).toBeVisible();
       // payment_status should be empty for unpaid
       await expect(page.getByText(/Payment: Unpaid|Payment Status: Unpaid/i)).toBeVisible();
    }
  });

  test('Daily Progress & Date Visibility', async ({ page }) => {
    await page.goto('/');
    
    // 1. Date visibility on today's job cards
    const today = new Date();
    const dayOfMonth = today.getDate().toString();
    
    // Find a job card and check its date block
    const dateBlock = page.locator('div').filter({ hasText: 'TODAY' }).filter({ hasText: dayOfMonth }).first();
    await expect(dateBlock).toBeVisible();
    
    // 2. Daily Mission Progress bar
    // Progress bar has background color rgb(233, 30, 106) which is #E91E6A
    const progressBar = page.locator('div[style*="background: rgb(233, 30, 106)"]');
    
    // Initially check if visible (if there are jobs)
    if (await page.getByText(/house/i).isVisible()) {
        // We look for the progress bar that is inside the Hero section
        const heroProgress = page.locator('div[style*="height: 4px"]').locator('div[style*="background"]');
        await expect(heroProgress).toBeVisible();
        const initialWidth = await heroProgress.evaluate(el => el.style.width);
        
        // Complete a job and verify progress updates
        const sarahCard = page.locator('div').filter({ hasText: /Sarah/i }).first();
        await sarahCard.click({ force: true });
        await page.getByRole('button', { name: 'Mark Paid' }).click({ force: true });
        await page.getByRole('button', { name: /Save & Log Paid/ }).click({ force: true });
        await page.waitForTimeout(3000);
        
        const updatedWidth = await heroProgress.evaluate(el => el.style.width);
        expect(parseFloat(updatedWidth)).toBeGreaterThanOrEqual(parseFloat(initialWidth));
    }
  });
});
