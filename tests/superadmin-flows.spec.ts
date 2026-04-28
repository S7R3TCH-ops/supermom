import { test, expect } from '@playwright/test';

test.describe('Super Admin Flows', () => {
  test.use({ storageState: 'playwright/.auth/superadmin.json' });

  test.beforeEach(async ({ page }) => {
    // Navigate to admin page before each test
    await page.goto('/admin');
    await expect(page).toHaveURL(/.*admin.*/);
  });

  test('exclusive UI elements and access', async ({ page }) => {
    // 1. Verify access to /admin (already done in beforeEach)
    await expect(page.getByText('Business Admin', { exact: false })).toBeVisible();
    
    // 2. Check for Super Admin specific sections
    await expect(page.getByText('Super Admin: Viewpoint')).toBeVisible();
    await expect(page.getByText('Super Admin: Provisioning')).toBeVisible();
    await expect(page.getByText('Super Admin: Data Management')).toBeVisible();

    // 3. Verify SUPER ADMIN badge in Settings
    await page.goto('/settings');
    await expect(page.getByText('SUPER ADMIN')).toBeVisible();
    
    // Verify the badge has the expected styling (danger red theme)
    const badge = page.getByText('SUPER ADMIN');
    await expect(badge).toHaveCSS('color', 'rgb(239, 68, 68)'); // #ef4444
  });

  test('viewpoint switching flow', async ({ page }) => {
    // 1. Select a business from the viewpoint dropdown
    const select = page.locator('select').first();
    await select.waitFor();
    
    // Get the name of the first business (excluding placeholder)
    const options = await select.locator('option').all();
    if (options.length <= 1) {
      test.skip(true, 'No businesses available to switch to');
      return;
    }
    
    const bizName = await options[1].textContent();
    const cleanName = bizName?.split('(')[0].trim();
    
    await select.selectOption({ index: 1 });
    
    // 2. Click Switch
    await page.getByRole('button', { name: 'Switch' }).click();
    
    // 3. Verify the viewpoint switch (check for banner)
    const banner = page.locator('div').filter({ hasText: `Viewing as ${cleanName}` }).first();
    // Use a regex to be safe with partial matches
    await expect(page.getByText(/Viewing as/)).toBeVisible();
    
    // 4. Verify resetting the viewpoint
    const exitBtn = page.getByRole('button', { name: 'EXIT' });
    await expect(exitBtn).toBeVisible();
    await exitBtn.click();
    
    // 5. Verify banner is gone
    await expect(exitBtn).not.toBeVisible();
    await expect(page.getByText(/Viewing as/)).not.toBeVisible();
  });

  test('business provisioning flow', async ({ page }) => {
    const uniqueEmail = `test-biz-${Date.now()}@supermom.io`;
    
    // 1. Fill out the "Super Admin: Provisioning" form
    await page.getByPlaceholder('Business Name').fill('Automated Test Biz');
    await page.getByPlaceholder('Owner Full Name').fill('Test Owner');
    await page.getByPlaceholder('Owner Email').fill(uniqueEmail);
    await page.getByPlaceholder('Temp Password').fill('TempPass123!');
    
    // 2. Click "Create Business & Owner"
    await page.getByRole('button', { name: 'Create Business & Owner' }).click();
    
    // 3. Verify successful provisioning message
    // It shows "Successfully provisioned! ✓" in the UI or a toast
    await expect(page.getByText(/Successfully provisioned|Business provisioned/)).toBeVisible({ timeout: 15000 });
  });

  test('soft deleting flow', async ({ page }) => {
    // 1. Locate the "Data Management" section and find a business to delete
    // We'll target the first business in the list that isn't already deleted
    const deleteBtn = page.getByRole('button', { name: 'DELETE' }).first();
    
    if (!(await deleteBtn.isVisible())) {
      test.skip(true, 'No businesses available to delete');
      return;
    }
    
    // 2. Handle the confirmation dialog
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Are you sure you want to soft delete business');
      await dialog.accept();
    });
    
    // 3. Click DELETE
    await deleteBtn.click();
    
    // 4. Verify successful deletion (toast or list update)
    // The toast message is like "Name" removed.
    await expect(page.getByText(/removed\.|successfully deleted/)).toBeVisible();
  });
});

test.describe('Standard User Access Control', () => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('standard user cannot access /admin', async ({ page }) => {
    // Navigate to admin page
    await page.goto('/admin');
    
    // Expect to be redirected to home since not a super admin
    // We wait for the URL to change to the base URL
    await expect(page).toHaveURL('http://localhost:5173/', { timeout: 10000 });
    await expect(page).not.toHaveURL(/.*admin.*/);
  });
});
