import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Run as the canonical QA account
test.use({ storageState: 'playwright/.auth/user.json' });

const OUT_DIR = path.join(process.cwd(), 'audit-output');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

let shotIdx = 0;
async function ss(page: Page, label: string) {
  shotIdx++;
  const fname = `${String(shotIdx).padStart(2,'0')}-${label}.png`;
  await page.screenshot({ path: path.join(OUT_DIR, fname), fullPage: false });
  console.log(`📸 ${fname}`);
}

test('Audit daily ops flow for viewport bugs (Pixel 10 Pro simulation)', async ({ page }) => {
  test.setTimeout(60000);
  const traces: any[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      traces.push({ type: 'console', severity: msg.type(), text: msg.text() });
    }
  });
  page.on('pageerror', err => {
    traces.push({ type: 'pageerror', error: err.message });
  });
  page.on('requestfailed', request => {
    traces.push({ type: 'network', url: request.url(), error: request.failure()?.errorText });
  });

  // 1. Home
  console.log('\n=== Step 1: Home ===');
  await page.goto('/');
  await page.waitForTimeout(2000);
  await ss(page, '01-home-load');

  // 2. Clients
  console.log('\n=== Step 2: Clients ===');
  await page.getByRole('link', { name: /clients/i }).click();
  await page.waitForTimeout(1500);
  await ss(page, '02-clients-page');

  // Open the first client card if available
  const clientCard = page.locator('div[style*="border-radius: 12px"]').first();
  if (await clientCard.isVisible().catch(() => false)) {
    await clientCard.click();
    await page.waitForTimeout(1500);
    await ss(page, '03-client-profile');
  }

  // 3. Job Detail
  console.log('\n=== Step 3: Job Detail ===');
  await page.getByRole('link', { name: /home/i }).first().click();
  await page.waitForTimeout(1500);
  
  // Try to find a job card and open it (Needs Attention wrap-up/unpaid/partial cards,
  // or a scheduled JobCard if the QA account has current-week jobs)
  const jobCard = page.locator('button, div[style*="cursor: pointer"]').filter({ hasText: /wrap up|unpaid|partial paid|scheduled|paid/i }).first();
  if (await jobCard.isVisible().catch(() => false)) {
    await jobCard.click({ force: true });
    await page.waitForTimeout(1500);
    
    // Verify job detail sheet opens via dialog role / aria-label
    const detailDialog = page.getByRole('dialog', { name: /job details/i });
    if (await detailDialog.isVisible().catch(() => false)) {
      await ss(page, '04-job-detail-sheet');

      // Close it — backdrop click (top of dialog, outside the bottom sheet which
      // stops propagation) so later steps aren't blocked by an open modal
      await detailDialog.click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(500);
    }
  }

  // 4. Keyboard-occlusion viewport-shrink simulation
  console.log('\n=== Step 4: Keyboard Shrink Simulation ===');
  const originalSize = page.viewportSize();
  if (originalSize) {
    traces.push({ type: 'info', message: `Original viewport: ${originalSize.width}x${originalSize.height}` });
    console.log(`Original viewport: ${originalSize.width}x${originalSize.height}`);
    
    // Simulate keyboard popping up (shrinking height by 300px)
    await page.setViewportSize({ width: originalSize.width, height: Math.max(300, originalSize.height - 300) });
    await page.waitForTimeout(1000);
    await ss(page, '05-viewport-shrunk');
    
    // Simulate keyboard dismissing
    await page.setViewportSize(originalSize);
    await page.waitForTimeout(1000);
    await ss(page, '06-viewport-restored');
  }

  // 5. Schedule
  console.log('\n=== Step 5: Schedule ===');
  await page.getByRole('link', { name: /schedule|calendar/i }).click();
  await page.waitForTimeout(1500);
  await ss(page, '07-schedule-page');

  // Save traces
  fs.writeFileSync(path.join(OUT_DIR, 'trace.json'), JSON.stringify(traces, null, 2));
  console.log(`\n✅ Audit complete. Saved ${traces.length} errors/warnings to audit-output/trace.json`);
});
