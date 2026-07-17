import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const outDir = path.join(process.cwd(), 'e2e', 'screenshots');

test.beforeAll(() => {
  fs.mkdirSync(outDir, { recursive: true });
});

test('landing page screenshot (green brand)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(outDir, 'landing.png'),
    fullPage: true,
  });
});

test('notes page screenshot after demo sign-in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({
    timeout: 30_000,
  });

  const viewDemo = page.getByRole('button', { name: /view demo/i });
  if (await viewDemo.isVisible()) {
    await viewDemo.click();
  } else {
    await page.getByRole('button', { name: /get started|sign in/i }).first().click();
    await page.getByLabel(/email or username|email address/i).first().fill('demo_user');
    await page.getByLabel(/^password$/i).first().fill('demo_user');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
  }

  // Notes shell: editor or sidebar once authenticated
  await expect(
    page.locator('textarea, [contenteditable="true"], .paper-page').first()
  ).toBeVisible({ timeout: 45_000 });

  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(outDir, 'notes.png'),
    fullPage: true,
  });
});
