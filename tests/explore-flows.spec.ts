/**
 * Exploratory flow: create client → book job (multiple paths) → partial payment → full payment + additional costs
 * Runs as superadmin (Joel) with viewpoint set to Sandra's business.
 * All flows run in ONE test to maintain shared state (client created in step 1 used in steps 2+).
 *
 * Run: npx playwright test tests/explore-flows.spec.ts --project=superadmin-chromium --reporter=list
 */
import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.use({ storageState: 'playwright/.auth/superadmin.json' });

const SS_DIR = path.join(process.cwd(), 'test-screenshots');
if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });

let shotIdx = 0;
async function ss(page: Page, label: string) {
  shotIdx++;
  const fname = `${String(shotIdx).padStart(2,'0')}-${label.replace(/[^a-z0-9]+/gi,'-')}.png`;
  await page.screenshot({ path: path.join(SS_DIR, fname), fullPage: false });
  console.log(`📸 ${fname}`);
}

const CLIENT_FIRST = 'Tester';
const CLIENT_LAST  = `Flow${Date.now().toString().slice(-6)}`;
const CLIENT_FULL  = `${CLIENT_FIRST} ${CLIENT_LAST}`;

async function switchViewpoint(page: Page) {
  await page.goto('/admin');
  await page.waitForTimeout(1800);
  const select = page.locator('select').first();
  if (await select.isVisible().catch(() => false)) {
    const options = await select.locator('option').all();
    if (options.length > 1) {
      await select.selectOption({ index: 1 });
      await page.getByRole('button', { name: /switch/i }).click();
      await page.waitForTimeout(1200);
    }
  }
  // Client-side nav preserves React state + superOverrideId
  await page.getByRole('link', { name: /home/i }).first().click();
  await page.waitForTimeout(1500);
}

test('Full owner flow — create client → book job → partial payment → complete with additional costs', async ({ page }) => {
  await page.addInitScript(() => { (window as any).__SKIP_ONBOARDING = true; });

  await switchViewpoint(page);
  await ss(page, '01-home-start');

  // ─────────────────────────────────────────────────────────────
  // PHASE 1: Create a new client from the Clients tab
  // ─────────────────────────────────────────────────────────────
  console.log('\n=== PHASE 1: Create client ===');
  await page.getByRole('link', { name: /clients/i }).click();
  await page.waitForTimeout(1000);
  await ss(page, '02-clients-page');

  // Open New Client sheet via the + button
  await page.getByRole('button', { name: /add client|\+/i }).first().click();
  await page.waitForTimeout(800);
  await ss(page, '03-new-client-sheet');

  const ncDialog = page.getByRole('dialog', { name: /add new client/i });
  await expect(ncDialog).toBeVisible({ timeout: 5000 });

  await ncDialog.getByLabel(/first name/i).fill(CLIENT_FIRST);
  await ncDialog.getByLabel(/last name/i).fill(CLIENT_LAST);
  await ncDialog.getByLabel(/phone/i).fill('6475550123');
  await ncDialog.getByLabel(/email/i).fill(`${CLIENT_LAST.toLowerCase()}@test.com`);
  await ncDialog.getByLabel(/street/i).fill('42 Flow Test Ave');
  await ss(page, '04-client-form-filled');

  await ncDialog.getByRole('button', { name: /save client/i }).click();
  await page.waitForTimeout(2000);
  await ss(page, '05-after-client-save');

  const clientVisible = await page.getByText(CLIENT_FULL).first().isVisible().catch(() => false);
  if (!clientVisible) {
    console.warn(`⚠️  BUG: Client "${CLIENT_FULL}" not visible in list after saving`);
  } else {
    console.log(`✅ Client "${CLIENT_FULL}" created and visible`);
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 2A: Book a job via the Home FAB → pick the new client
  // ─────────────────────────────────────────────────────────────
  console.log('\n=== PHASE 2A: Book job via Home FAB ===');
  await page.getByRole('link', { name: /home/i }).first().click();
  await page.waitForTimeout(1000);

  const fab = page.getByRole('button', { name: /book new job/i });
  await expect(fab).toBeVisible({ timeout: 5000 });
  await fab.click();
  await page.waitForTimeout(1000);
  await ss(page, '06-new-job-step1');

  const njDialog = page.getByRole('dialog', { name: /book new job/i });
  await expect(njDialog).toBeVisible();

  // Step1: check client cards (they only show first name)
  const clientButtons = njDialog.locator('button').filter({ has: page.locator('div').filter({ hasText: CLIENT_FIRST }).first() });
  const allBtns = await njDialog.locator('button').all();
  console.log(`Step 1 has ${allBtns.length} buttons total`);

  // Find by first name text — client cards show first name only (known UX bug)
  const targetClientBtn = njDialog.locator('button').filter({ hasText: CLIENT_FIRST });
  const targetCount = await targetClientBtn.count();
  console.log(`Buttons with text "${CLIENT_FIRST}": ${targetCount}`);
  if (targetCount === 0) {
    console.warn(`⚠️  BUG or issue: No client card found for "${CLIENT_FIRST}" in Step 1`);
    // Just click the first available client as fallback
    const anyClient = njDialog.locator('button').filter({ has: page.locator('[style*="border-radius: 12px"]') }).first();
    if (await anyClient.isVisible()) await anyClient.click();
  } else {
    // Click the LAST matching (most recently added)
    await targetClientBtn.last().click();
  }
  await page.waitForTimeout(600);
  await ss(page, '07-client-selected-in-step1');

  // Verify selected client banner shows (it shows full name including last)
  const selectedBanner = njDialog.getByText(CLIENT_FULL);
  const bannerVisible = await selectedBanner.isVisible().catch(() => false);
  if (!bannerVisible) {
    console.warn(`⚠️  BUG: Selected client banner doesn't show full name "${CLIENT_FULL}"`);
  } else {
    console.log('✅ Selected client banner shows full name correctly');
  }

  await njDialog.getByRole('button', { name: /next/i }).click();
  await page.waitForTimeout(1000);
  await ss(page, '08-step2-what');

  // Step 2: pick first service
  const serviceBtn = njDialog.locator('button').filter({ hasText: /\$|\/hr/i }).first();
  if (!await serviceBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.warn('⚠️  No service buttons visible in Step 2');
  } else {
    await serviceBtn.click();
    await page.waitForTimeout(600);
  }
  await ss(page, '09-service-selected');

  await njDialog.getByRole('button', { name: /next/i }).click();
  await page.waitForTimeout(800);
  await ss(page, '10-step3-review');

  const bookBtn = njDialog.getByRole('button', { name: /book it/i });
  await expect(bookBtn).toBeVisible({ timeout: 5000 });
  await bookBtn.click();
  await page.waitForTimeout(2500);
  await ss(page, '11-after-job-booked');

  const jobOnHome = await page.getByText(CLIENT_FIRST).first().isVisible({ timeout: 8000 }).catch(() => false);
  if (!jobOnHome) {
    console.warn('⚠️  BUG: Job not visible on home screen after booking');
  } else {
    console.log('✅ Job appears on home screen after booking');
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 2B: Book a second job via Client Profile
  // ─────────────────────────────────────────────────────────────
  console.log('\n=== PHASE 2B: Book job from Client Profile ===');
  await page.getByRole('link', { name: /clients/i }).click();
  await page.waitForTimeout(1000);
  await ss(page, '12-clients-for-profile');

  const clientLink = page.getByText(CLIENT_FULL).first();
  const clientLinkVisible = await clientLink.isVisible({ timeout: 5000 }).catch(() => false);
  if (!clientLinkVisible) {
    console.warn(`⚠️  BUG: "${CLIENT_FULL}" not found in client list`);
  } else {
    await clientLink.click();
    await page.waitForTimeout(1200);
    await ss(page, '13-client-profile');

    await expect(page).toHaveURL(/\/clients\/.+/, { timeout: 5000 });

    const bookJobBtn = page.getByRole('button', { name: 'Book Job' });
    const bookBtnVisible = await bookJobBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!bookBtnVisible) {
      console.warn('⚠️  BUG: No "Book job" button on client profile page');
    } else {
      await ss(page, '14-profile-book-button');
      await bookJobBtn.click();
      await page.waitForTimeout(1000);
      await ss(page, '15-new-job-from-profile');

      const profileDialog = page.getByRole('dialog', { name: /book new job/i });
      await expect(profileDialog).toBeVisible();

      // Should open at step 2 (client pre-selected); step indicator shows "Step 1 of 2"
      const stepLabel = await profileDialog.getByText(/step/i).first().innerText().catch(() => '?');
      console.log(`Step label when opened from profile: "${stepLabel}"`);
      if (stepLabel.includes('1 of 3') || stepLabel.includes('Step 1')) {
        console.warn('⚠️  BUG: Opening from profile shows Step 1 instead of Step 2');
      }

      // Pick a service
      const svc = profileDialog.locator('button').filter({ hasText: /\$|\/hr/i }).first();
      if (await svc.isVisible({ timeout: 5000 }).catch(() => false)) {
        await svc.click();
        await page.waitForTimeout(600);
        await profileDialog.getByRole('button', { name: /next/i }).click();
        await page.waitForTimeout(800);
        await ss(page, '16-profile-job-step3');

        const profileBookBtn = profileDialog.getByRole('button', { name: /book it/i });
        await expect(profileBookBtn).toBeVisible({ timeout: 5000 });
        await profileBookBtn.click();
        await page.waitForTimeout(2000);
        await ss(page, '17-profile-job-booked');
        console.log('✅ Second job booked from client profile');
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 3: Open the first job and record PARTIAL payment
  // ─────────────────────────────────────────────────────────────
  console.log('\n=== PHASE 3: Partial payment ===');
  await page.getByRole('link', { name: /home/i }).first().click();
  await page.waitForTimeout(3000); // Wait for toast to clear and data to settle
  await ss(page, '18-home-with-new-jobs');

  // Scroll down to see agenda job cards below the "Next Up" hero card
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(500);
  await ss(page, '18b-home-scrolled');

  // Click the full name text in the job card (not the all-caps section header)
  // The section header is uppercase ("TESTER FLOW..."), the card heading is title case
  const jobCards = page.getByText(CLIENT_FULL);
  const cardCount = await jobCards.count();
  console.log(`Found ${cardCount} elements with text "${CLIENT_FULL}"`);

  // Use .last() — the section header "WHAT'S NEXT TODAY · ..." also matches case-insensitively,
  // so .first() hits the non-interactive header label. .last() gets the card heading.
  if (cardCount > 0) {
    await jobCards.last().click({ force: true });
  }
  await page.waitForTimeout(2000);
  await ss(page, '19-job-detail-open');

  const detailDialog = page.getByRole('dialog', { name: /job details/i });
  if (!await detailDialog.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.warn('⚠️  BUG: Job detail sheet did not open');
  } else {
    // Check which action buttons are present
    const hasMarkComplete = await detailDialog.getByRole('button', { name: /mark complete/i }).isVisible().catch(() => false);
    const hasMarkPaid = await detailDialog.getByRole('button', { name: /mark paid/i }).isVisible().catch(() => false);
    const hasEditJob = await detailDialog.getByRole('button', { name: /edit job/i }).isVisible().catch(() => false);
    console.log(`Job detail buttons — Mark Complete: ${hasMarkComplete}, Mark Paid: ${hasMarkPaid}, Edit Job: ${hasEditJob}`);

    if (!hasMarkComplete && !hasMarkPaid) {
      console.warn('⚠️  BUG: Neither "Mark Complete" nor "Mark Paid" visible on job detail');
    }

    await ss(page, '20-job-detail-buttons');
    const actionBtn = hasMarkComplete
      ? detailDialog.getByRole('button', { name: /mark complete/i })
      : detailDialog.getByRole('button', { name: /mark paid/i });
    await actionBtn.click();
    await page.waitForTimeout(1500);
    await ss(page, '21-post-job-sheet');

    const pjDialog = page.getByRole('dialog', { name: /complete job/i });
    if (!await pjDialog.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.warn('⚠️  BUG: PostJobSheet did not open');
    } else {
      // Default should be "Paid" — verify
      const isPaidDefault = await pjDialog.getByRole('button', { name: /paid ✓/i }).evaluate((el) => {
        return el.style.background.includes('rgba') && el.style.background.includes('34,197,94');
      }).catch(() => false);
      console.log('PostJobSheet defaults to Paid:', isPaidDefault);

      // Switch to Partial
      await pjDialog.getByRole('button', { name: /partial/i }).click();
      await page.waitForTimeout(400);
      await ss(page, '22-partial-mode');

      // Check balance owing display
      const balanceShown = await pjDialog.getByText(/balance owing/i).isVisible().catch(() => false);
      if (!balanceShown) {
        console.warn('⚠️  BUG: "Balance owing" display not visible after selecting Partial');
      } else {
        console.log('✅ Balance owing display visible');
      }

      // Set partial amount to $20
      const amtInput = pjDialog.locator('input[type="number"]').first();
      await amtInput.click({ clickCount: 3 });
      await amtInput.fill('20');
      await page.waitForTimeout(300);
      await ss(page, '23-partial-amount-set');

      // Check balance math
      const balanceText = await pjDialog.getByText(/balance owing/i).textContent().catch(() => '');
      console.log('Balance owing text:', balanceText);

      // Add a post-job note before saving
      const textarea = pjDialog.locator('textarea');
      await textarea.fill('Partial payment received. Will collect remainder next visit.');

      const savePartialBtn = pjDialog.getByRole('button', { name: /save.*log partial|log partial/i }).last();
      if (!await savePartialBtn.isVisible().catch(() => false)) {
        console.warn('⚠️  BUG: Save & Log Partial button not found');
        await ss(page, '23b-save-btn-not-found');
      } else {
        await ss(page, '24-ready-to-save-partial');
        await savePartialBtn.click();
        await page.waitForTimeout(3000);
        await ss(page, '25-after-partial-save');
        console.log('✅ Partial payment recorded');
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 4: Complete remaining payment with additional costs
  // ─────────────────────────────────────────────────────────────
  console.log('\n=== PHASE 4: Complete payment with additional costs ===');
  await page.getByRole('link', { name: /home/i }).first().click();
  await page.waitForTimeout(2500);
  await ss(page, '26-home-after-partial');

  // Re-open the same job — use .last() to target card heading, not section header
  const sameJobEl = page.getByText(CLIENT_FULL).last();
  if (await sameJobEl.isVisible({ timeout: 5000 }).catch(() => false)) {
    await sameJobEl.click({ force: true });
  }
  await page.waitForTimeout(2000);
  await ss(page, '27-job-detail-after-partial');

  const detail2 = page.getByRole('dialog', { name: /job details/i });
  if (await detail2.isVisible({ timeout: 5000 }).catch(() => false)) {
    // Verify Partial badge is shown
    const partialBadge = await detail2.getByText('Partial').isVisible().catch(() => false);
    console.log('Partial badge visible:', partialBadge);
    if (!partialBadge) {
      console.warn('⚠️  BUG: Partial badge not visible — job status may not have updated');
    }

    // Mark Complete should NOT be visible (job is now completed)
    // Mark Paid SHOULD be visible (payment is partial)
    const mc2 = await detail2.getByRole('button', { name: /mark complete/i }).isVisible().catch(() => false);
    const mp2 = await detail2.getByRole('button', { name: /mark paid/i }).isVisible().catch(() => false);
    console.log(`After partial — Mark Complete: ${mc2}, Mark Paid: ${mp2}`);
    if (!mp2) {
      console.warn('⚠️  BUG: "Mark Paid" not visible after partial payment on completed job');
    }

    await ss(page, '28-post-partial-buttons');

    if (mp2) {
      await detail2.getByRole('button', { name: /mark paid/i }).click();
      await page.waitForTimeout(1500);
      await ss(page, '29-post-job-for-completion');

      const pj2 = page.getByRole('dialog', { name: /complete job/i });
      if (await pj2.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Add first additional cost
        const costAmt1 = pj2.locator('input[placeholder="0"]').first();
        await costAmt1.fill('18');
        const costDesc1 = pj2.locator('input[placeholder*="cleaning supplies" i]').first();
        await costDesc1.fill('Cleaning supplies');
        await page.waitForTimeout(300);

        // Add second cost
        const addCostBtn = pj2.getByRole('button', { name: /add another cost/i });
        await addCostBtn.click();
        await page.waitForTimeout(400);
        await ss(page, '30-two-cost-rows');

        const costRows = await pj2.locator('input[placeholder="0"]').count();
        console.log(`Cost rows after "Add another": ${costRows}`);
        if (costRows < 2) {
          console.warn('⚠️  BUG: Second cost row did not appear after clicking "+ Add another cost"');
        } else {
          await pj2.locator('input[placeholder="0"]').nth(1).fill('12');
          await pj2.locator('input[placeholder*="cleaning supplies" i]').nth(1).fill('Mileage');
        }

        // Remove a cost via × button to verify remove works
        const removeBtn = pj2.getByRole('button', { name: /remove cost/i }).first();
        if (await removeBtn.isVisible().catch(() => false)) {
          await removeBtn.click();
          await page.waitForTimeout(300);
          const rowsAfterRemove = await pj2.locator('input[placeholder="0"]').count();
          console.log(`Cost rows after remove: ${rowsAfterRemove}`);
        }

        // Add post-job notes
        await pj2.locator('textarea').fill('Job complete. Client was happy. Collected full payment.');
        await ss(page, '31-completion-filled');

        // Click "Save & Log Paid"
        const saveFullBtn = pj2.getByRole('button', { name: /save.*log paid|log paid/i }).last();
        if (!await saveFullBtn.isVisible().catch(() => false)) {
          console.warn('⚠️  BUG: "Save & Log Paid" button not visible');
          await ss(page, '31b-save-paid-not-found');
        } else {
          await saveFullBtn.click();
          await page.waitForTimeout(3000);
          await ss(page, '32-after-full-payment');
          console.log('✅ Full payment with additional costs recorded');
        }
      } else {
        console.warn('⚠️  BUG: PostJobSheet did not open when clicking "Mark Paid" on partial job');
      }
    }
  } else {
    console.warn('⚠️  Could not open job detail after partial payment');
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 5: Verify job detail shows all data
  // ─────────────────────────────────────────────────────────────
  console.log('\n=== PHASE 5: Verify final job state ===');
  await page.getByRole('link', { name: /home/i }).first().click();
  await page.waitForTimeout(1500);
  await ss(page, '33-home-final');

  // Try to open the completed job by full name
  const finalCard = page.getByText(CLIENT_FULL).first();
  if (await finalCard.isVisible({ timeout: 3000 }).catch(() => false)) {
    await finalCard.click();
  } else {
    // Job may not show on home if all done; try Finance tab
    await page.getByRole('link', { name: /finance/i }).click();
    await page.waitForTimeout(1000);
    await ss(page, '34-finance-tab');
    await page.getByText(CLIENT_FIRST).last().click().catch(() => {});
  }
  await page.waitForTimeout(1200);
  await ss(page, '35-final-job-detail');

  const finalDetail = page.getByRole('dialog', { name: /job details/i });
  if (await finalDetail.isVisible({ timeout: 3000 }).catch(() => false)) {
    const paidBadge = await finalDetail.getByText('Paid').isVisible().catch(() => false);
    const addlCost  = await finalDetail.getByText(/additional cost/i).isVisible().catch(() => false);
    const postNotes = await finalDetail.getByText(/post-job notes/i).isVisible().catch(() => false);
    const invoiceBtn = await finalDetail.getByRole('button', { name: /view/i }).isVisible().catch(() => false);

    console.log(`Final state — Paid badge: ${paidBadge}, Additional cost: ${addlCost}, Post-job notes: ${postNotes}, Invoice: ${invoiceBtn}`);

    if (!paidBadge) console.warn('⚠️  BUG: Paid badge not showing on completed+paid job');
    if (!addlCost)  console.warn('⚠️  BUG: Additional cost row not visible in job detail');
    if (!postNotes) console.warn('⚠️  BUG: Post-job notes section not visible in job detail');

    if (invoiceBtn) {
      const [popup] = await Promise.all([
        page.context().waitForEvent('page'),
        finalDetail.getByRole('button', { name: /view/i }).click(),
      ]);
      await popup.waitForLoadState('networkidle');
      await ss(popup as Page, '36-invoice-page');
      const totalVisible = await popup.getByText(/total/i).isVisible().catch(() => false);
      const addlLineVisible = await popup.getByText(/cleaning supplies|mileage/i).isVisible().catch(() => false);
      console.log(`Invoice — TOTAL visible: ${totalVisible}, Additional line items: ${addlLineVisible}`);
      if (!totalVisible) console.warn('⚠️  BUG: TOTAL not visible on invoice');
      if (!addlLineVisible) console.warn('⚠️  BUG: Additional cost line items not on invoice');
    } else {
      console.warn('⚠️  No invoice VIEW button found in job detail');
    }
  } else {
    console.warn('⚠️  Could not open final job detail for verification');
  }

  console.log('\n=== FLOW COMPLETE ===');
});
