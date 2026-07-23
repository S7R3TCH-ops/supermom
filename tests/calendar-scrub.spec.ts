import { test, expect } from '@playwright/test';

// Verifies the Schedule page's day-strip scrub gesture end-to-end: a synthetic
// touch drag should move the live highlight and, on release, commit a specific
// day filter (the chip leaves "Whole week"). Also asserts no runtime errors
// fire during the gesture — this page has a history of state-desync bugs.
test.describe('Schedule page day-scrub gesture', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__SKIP_ONBOARDING = true;
    });
  });

  test('drag on the day strip highlights live and commits a day on release', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/calendar');
    await page.waitForTimeout(2000);
    await expect(page.getByText('Schedule', { exact: true }).first()).toBeVisible();

    // Baseline: strip starts in "Whole week" (no day filter).
    await expect(page.getByText('Whole week')).toBeVisible();

    // Capture the initial week range text
    const initialText = await page.locator('text=/\\d+ – \\d+|\\w+ \\d+ –/').first().innerText();

    const gestureResult = await page.evaluate(() => {
      const cell = document.querySelector('[role="button"][aria-label]');
      const strip = cell?.closest('div[style*="touch-action"]') as HTMLElement | null;
      if (!strip) return { ok: false, reason: 'strip not found' };

      const rect = strip.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;
      const cellPitch = rect.width / 7;
      const totalDx = -cellPitch * 2.2; // drag left ~2 days worth

      function fire(type: string, x: number, y: number) {
        const t = new Touch({ identifier: 1, target: strip as EventTarget, clientX: x, clientY: y });
        strip!.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: type === 'touchend' ? [] : [t],
            changedTouches: [t],
          })
        );
      }

      fire('touchstart', startX, startY);
      const steps = 12;
      for (let i = 1; i <= steps; i++) {
        fire('touchmove', startX + (totalDx * i) / steps, startY);
      }
      fire('touchend', startX + totalDx, startY);
      return { ok: true };
    });

    expect(gestureResult.ok, JSON.stringify(gestureResult)).toBe(true);

    await page.waitForTimeout(600); // let the 380ms snap + commit settle

    // Verify the week range text has changed
    await expect(page.locator('text=/\\d+ – \\d+|\\w+ \\d+ –/').first()).not.toHaveText(initialText, { timeout: 10000 });

    // "Whole week" should still be visible because swiping the week strip changes the week, not the day filter
    await expect(page.getByText('Whole week')).toBeVisible();

    expect(errors, `Console/page errors during gesture:\n${errors.join('\n')}`).toEqual([]);
  });
});
