import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('landing / auth is reachable and has no critical a11y blockers', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({
    timeout: 30_000,
  });

  // Sign in CTA → auth form with labelled fields
  const getStarted = page.getByRole('button', { name: /get started|sign in/i }).first();
  if (await getStarted.isVisible()) {
    await getStarted.click();
  }
  await expect(page.getByLabel(/email or username|email address/i).first()).toBeVisible({
    timeout: 15_000,
  });

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const critical = results.violations.filter((v) => v.impact === 'critical');
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
});
