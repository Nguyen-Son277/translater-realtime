import { test, expect } from '@playwright/test';

const account = { id: 'brand-test', username: 'tester', name: 'Tester', is_admin: false };
async function mockAuth(page, authenticated = false) {
  await page.route('**/api/auth/me', route => route.fulfill({ status: authenticated ? 200 : 401, json: authenticated ? account : { detail: 'Unauthorized' } }));
  await page.route('**/api/rooms', route => route.fulfill({ json: [] }));
  await page.route('**/api/config', route => route.fulfill({ json: { languages: {}, speech: 'ready', translation_configured: true } }));
  await page.route('**/api/feedback?*', route => route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 20 } }));
  await page.route('**/api/support', route => route.fulfill({ json: { content: 'Ủng hộ Transqora phát triển mobile', qr_url: null, revision: 0 } }));
}

test('brand logo, localized title and favicon assets are wired on every public screen', async ({ page }) => {
  page.on('pageerror', error => console.error('Brand page error:', error.message));
  await mockAuth(page);
  for (const path of ['/login', '/guide', '/feedback', '/updates', '/support']) {
    await page.goto(path);
    await expect(page).toHaveTitle('Transqora — Hội thoại không khoảng cách');
    const logo = page.locator('.brand-logo:visible').first();
    await expect(logo).toBeVisible();
    expect(await logo.evaluate(img => img.complete && img.naturalWidth > 0)).toBeTruthy();
    await expect(page.locator('body')).not.toContainText('Song Ngữ');
  }
  await page.getByLabel('Chọn ngôn ngữ giao diện').selectOption('en');
  await expect(page).toHaveTitle('Transqora — Bridging Languages');
  await page.getByLabel('Select interface language').selectOption('zh-CN');
  await expect(page).toHaveTitle('Transqora — 跨越语言的对话');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', /apple-touch-icon/);
  for (const [path, contentType] of [['/favicon.svg?v=transqora-1', 'image/svg+xml'], ['/favicon.ico?v=transqora-1', /image\/(?:x-icon|vnd.microsoft.icon)/], ['/apple-touch-icon.png?v=transqora-1', 'image/png']]) {
    const response = await page.request.get(path);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toEqual(typeof contentType === 'string' ? expect.stringContaining(contentType) : expect.stringMatching(contentType));
  }
});

test('legacy locale migrates without losing preference, new key wins on next visit', async ({ page }) => {
  await mockAuth(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem('brand-test-initialized')) {
      localStorage.setItem('songngu.uiLocale', 'en');
      localStorage.setItem('brand-test-initialized', 'yes');
    }
  });
  await page.goto('/guide');
  await expect(page).toHaveTitle('Transqora — Bridging Languages');
  expect(await page.evaluate(() => localStorage.getItem('transqora.uiLocale'))).toBe('en');
  await page.getByLabel('Select interface language').selectOption('zh-CN');
  await page.reload();
  await expect(page).toHaveTitle('Transqora — 跨越语言的对话');
});

test('Transqora logo and dashboard fit narrow and wide layouts', async ({ page }) => {
  await mockAuth(page, true);
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/guide', '/updates']) {
      await page.goto(path);
      await expect(page.locator('.brand-logo:visible').first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'Transqora — Trang chủ' }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} ${path}`).toBeTruthy();
      await expect(page.locator('body')).not.toContainText('songngữ.');
    }
  }
});
