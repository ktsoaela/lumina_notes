import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

/** Screenshots for README + docs/features (committed under docs/features/screenshots). */
const outDir = path.join(process.cwd(), 'docs', 'features', 'screenshots');

const MERMAID_SAMPLE = `# Mermaid demo

\`\`\`mermaid
flowchart LR
  A[Write] --> B[Preview]
  B --> C[Ship]
\`\`\`
`;

const PLOTLY_SAMPLE = `# Plotly demo

\`\`\`plotly
{
  "data": [{ "x": [1, 2, 3, 4], "y": [10, 15, 13, 17], "type": "scatter" }],
  "layout": { "title": "Sample chart", "height": 320, "margin": { "t": 40 } }
}
\`\`\`
`;

async function signInDemo(page: Page) {
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
  await expect(
    page.locator('textarea, [contenteditable="true"], .paper-page').first()
  ).toBeVisible({ timeout: 45_000 });
}

async function goNotes(page: Page) {
  const notes = page.getByRole('button', { name: /^notes$/i });
  if (await notes.isVisible()) await notes.click();
}

async function setEditorContent(page: Page, content: string) {
  const editor = page.locator('textarea').first();
  await expect(editor).toBeVisible({ timeout: 15_000 });
  await editor.click();
  await editor.fill(content);
  await page.waitForTimeout(800);
}

test.beforeAll(() => {
  fs.mkdirSync(outDir, { recursive: true });
});

test.describe.configure({ mode: 'serial' });

test('docs screenshots — landing + all features', async ({ page }) => {
  // 1. Landing
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(outDir, 'landing.png'),
    fullPage: true,
  });

  // 2. Notes overview
  await signInDemo(page);
  await goNotes(page);
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(outDir, 'notes-overview.png'),
    fullPage: true,
  });

  // 3. Hierarchy (sidebar — look for + Book control)
  const addBook = page.getByRole('button', { name: /\+?\s*book/i }).first();
  if (await addBook.isVisible()) {
    const box = await addBook.boundingBox();
    if (box) {
      await page.screenshot({
        path: path.join(outDir, 'hierarchy.png'),
        clip: {
          x: 0,
          y: Math.max(0, box.y - 80),
          width: Math.min(420, page.viewportSize()?.width ?? 420),
          height: 700,
        },
      });
    } else {
      await page.screenshot({
        path: path.join(outDir, 'hierarchy.png'),
        fullPage: true,
      });
    }
  } else {
    await page.screenshot({
      path: path.join(outDir, 'hierarchy.png'),
      fullPage: true,
    });
  }

  // 4. Markdown split view (default demo content)
  await page.screenshot({
    path: path.join(outDir, 'markdown.png'),
    fullPage: true,
  });

  // 5. Mermaid
  await setEditorContent(page, MERMAID_SAMPLE);
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(outDir, 'mermaid.png'),
    fullPage: true,
  });

  // 6. Plotly
  await setEditorContent(page, PLOTLY_SAMPLE);
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(outDir, 'plotly.png'),
    fullPage: true,
  });

  // 7. Export toolbar (Print / Markdown / PDF)
  await expect(page.getByRole('button', { name: /^print$/i })).toBeVisible({
    timeout: 10_000,
  });
  await page.screenshot({
    path: path.join(outDir, 'export.png'),
    fullPage: true,
  });

  // 8. Quick search — click toolbar (Ctrl+K can miss in headless)
  await page.getByRole('button', { name: /search/i }).first().click();
  await expect(
    page.getByPlaceholder(/search notebook, section, or page/i)
  ).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(outDir, 'search.png'),
    fullPage: true,
  });
  await page.keyboard.press('Escape');

  // 9. Library / bookshelves
  const library = page.getByRole('button', { name: /^library$/i });
  if (await library.isVisible()) {
    await library.click();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(outDir, 'library.png'),
      fullPage: true,
    });
  }

  // 10. Profile / sync + sticky target (mobile & desktop docs)
  const profile = page.getByRole('button', { name: /^profile$/i });
  if (await profile.isVisible()) {
    await profile.click();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(outDir, 'profile-sync.png'),
      fullPage: true,
    });

    const stickyTab = page.getByRole('button', { name: /sticky/i }).or(
      page.getByText(/sticky note strips/i)
    );
    if (await stickyTab.first().isVisible()) {
      await stickyTab.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(outDir, 'sticky-strips.png'),
        fullPage: true,
      });
    } else {
      // Web UI: sticky config is desktop-only — capture profile as stand-in
      await page.screenshot({
        path: path.join(outDir, 'sticky-strips.png'),
        fullPage: true,
      });
    }
  }

  // 11. Install / PWA hint if banner present, else landing CTA area
  await page.goto('/');
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(outDir, 'mobile-pwa.png'),
    fullPage: false,
  });
});
