import { test, expect } from '@playwright/test';

// Verifies the swipe-to-change-day extension on the agenda/schedule content
// area (below the WeekStrip) — same gesture family as calendar-scrub.spec.ts,
// but targeting the job-list container itself instead of the day strip.
// agendaDayFilter is the single state both surfaces drive, so a swipe here
// should commit a day filter exactly like a strip drag does.
test.describe('Schedule page agenda content-area swipe', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__SKIP_ONBOARDING = true;
    });
  });

  test('drag on the agenda list commits a day filter on release', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/calendar');
    await page.waitForTimeout(2000);
    await expect(page.getByText('Schedule', { exact: true })).toBeVisible();

    // Baseline: no day filter set.
    await expect(page.getByText('Whole week')).toBeVisible();

    const gestureResult = await page.evaluate(() => {
      const chip = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Whole week')
      );
      const list = chip?.closest('div.sm-scroll') as HTMLElement | null;
      if (!list) return { ok: false, reason: 'agenda content area not found' };

      const rect = list.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + 20;
      const totalDx = -rect.width * 0.6; // drag left well past the commit threshold

      function fire(type: string, x: number, y: number) {
        const t = new Touch({ identifier: 1, target: list as EventTarget, clientX: x, clientY: y });
        list!.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: type === 'touchend' ? [] : [t],
            changedTouches: [t],
          })
        );
      }

      fire('touchstart', startX, startY);
      const steps = 10;
      for (let i = 1; i <= steps; i++) {
        fire('touchmove', startX + (totalDx * i) / steps, startY);
      }
      fire('touchend', startX + totalDx, startY);
      return { ok: true };
    });

    expect(gestureResult.ok, JSON.stringify(gestureResult)).toBe(true);

    await page.waitForTimeout(600); // let the 380ms snap + commit settle

    // A specific day is now filtered — chip left "Whole week".
    await expect(page.getByText('Whole week')).not.toBeVisible();

    expect(errors, `Console/page errors during gesture:\n${errors.join('\n')}`).toEqual([]);
  });

  test('a small drag under the commit threshold springs back without changing the filter', async ({ page }) => {
    await page.goto('/calendar');
    await page.waitForTimeout(2000);
    await expect(page.getByText('Whole week')).toBeVisible();

    const gestureResult = await page.evaluate(() => {
      const chip = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Whole week')
      );
      const list = chip?.closest('div.sm-scroll') as HTMLElement | null;
      if (!list) return { ok: false, reason: 'agenda content area not found' };

      const rect = list.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + 20;
      const totalDx = -30; // under the 50px commit threshold

      function fire(type: string, x: number, y: number) {
        const t = new Touch({ identifier: 1, target: list as EventTarget, clientX: x, clientY: y });
        list!.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: type === 'touchend' ? [] : [t],
            changedTouches: [t],
          })
        );
      }

      fire('touchstart', startX, startY);
      fire('touchmove', startX + totalDx, startY);
      fire('touchend', startX + totalDx, startY);
      return { ok: true };
    });

    expect(gestureResult.ok, JSON.stringify(gestureResult)).toBe(true);
    await page.waitForTimeout(500);
    await expect(page.getByText('Whole week')).toBeVisible();
  });
});
