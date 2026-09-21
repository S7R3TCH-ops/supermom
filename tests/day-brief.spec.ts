import { test, expect } from '@playwright/test';

// Stage D Prep: Day Brief on Home Hero
// Tests the UI layer of the ai_briefs integration (Home screen)
test.describe('Home hero AI day-brief (Stage D)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__SKIP_ONBOARDING = true;
    });
    // Standard mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('displays the day brief when a valid row for today exists', async ({ page }) => {
    // Intercept Supabase RLS reads to inject a fake day-brief
    await page.route('**/rest/v1/ai_briefs*', async route => {
      const today = new Date().toISOString().split('T')[0]; // Toronto date roughly matches local ISO in tests
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          kind: 'day',
          subject_date: today, // Must be today to render
          content: {
            summary: "Ann's 4pm has an open note. Tomorrow starts at 8.",
            summary_private: "Ann's 4pm has an open note. Tomorrow starts early."
          }
        }])
      });
    });

    await page.goto('/');
    await page.waitForTimeout(1000);

    // The canned greeting should be visible, but we won't assert its exact text since it's dynamic
    await expect(page.locator('.flex-col').first()).toBeVisible();
    
    // Verify the new day-brief line is rendered
    const briefLine = page.getByText("Ann's 4pm has an open note. Tomorrow starts at 8.");
    await expect(briefLine).toBeVisible();

    // Verify typography and clamp via computed styles (design doc §5)
    const styles = await briefLine.evaluate(el => {
      const comp = window.getComputedStyle(el);
      return {
        webkitLineClamp: comp.webkitLineClamp,
        fontSize: comp.fontSize,
      };
    });
    
    // Expecting 2-line clamp and ~13px font
    expect(styles.webkitLineClamp).toBe('2');
    expect(styles.fontSize).toBe('13px');
  });

  test('swaps to summary_private when Privacy Mode is on', async ({ page }) => {
    // Provide a brief with both a regular and private summary
    await page.route('**/rest/v1/ai_briefs*', async route => {
      const today = new Date().toISOString().split('T')[0];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          kind: 'day',
          subject_date: today,
          content: {
            summary: "Maria owes $120. Tomorrow starts at 8.",
            summary_private: "Maria has a balance. Tomorrow starts at 8."
          }
        }])
      });
    });

    await page.goto('/');
    await page.waitForTimeout(1000);

    // Default state: privacy off
    await expect(page.getByText("Maria owes $120. Tomorrow starts at 8.")).toBeVisible();

    // Turn on privacy mode using the UI toggle
    await page.getByTitle('Privacy mode').click();

    // Private summary should now be visible instead of the explicit money amount
    await expect(page.getByText("Maria has a balance. Tomorrow starts at 8.")).toBeVisible();
    await expect(page.getByText("Maria owes $120")).not.toBeVisible();
  });

  test('does not display brief if ai_enabled is false', async ({ page }) => {
    // Intercept settings to disable AI
    await page.route('**/rest/v1/app_settings*', async route => {
      const response = await route.fetch();
      const json = await response.json();
      if (Array.isArray(json) && json.length > 0) {
        json[0].ai_enabled = false;
      } else if (!Array.isArray(json) && json) {
        json.ai_enabled = false;
      }
      await route.fulfill({ response, body: JSON.stringify(json) });
    });

    // Provide a brief anyway to prove it's the kill-switch hiding it
    await page.route('**/rest/v1/ai_briefs*', async route => {
      const today = new Date().toISOString().split('T')[0];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          kind: 'day',
          subject_date: today,
          content: { summary: "This should not be seen." }
        }])
      });
    });

    await page.goto('/');
    await page.waitForTimeout(1000);

    await expect(page.getByText("This should not be seen.")).not.toBeVisible();
  });

  test('empty state holds minHeight so layout does not shift', async ({ page }) => {
    // Return empty array (no brief generated yet, or quiet day)
    await page.route('**/rest/v1/ai_briefs*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.goto('/');
    await page.waitForTimeout(1000);

    // Validate the height of the hero block to ensure it reserves space for 2 lines.
    // The wrapper containing the greeting should have a minimum height to prevent reflow.
    const container = page.locator('.flex-col').first();
    await expect(container).toBeVisible();

    const heroHeight = await container.evaluate(el => el.getBoundingClientRect().height);

    // Greeting is ~24px, plus minHeight for 2 lines of 13px text (~32px) + margins
    expect(heroHeight).toBeGreaterThan(45);
  });
  
  test('does not display yesterday’s brief', async ({ page }) => {
    // Return a brief with yesterday's date
    await page.route('**/rest/v1/ai_briefs*', async route => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          kind: 'day',
          subject_date: yesterday.toISOString().split('T')[0],
          content: { summary: "Yesterday's news." }
        }])
      });
    });

    await page.goto('/');
    await page.waitForTimeout(1000);

    // Should hide it because subject_date isn't today
    await expect(page.getByText("Yesterday's news.")).not.toBeVisible();
  });
});
