import { test, expect } from '@playwright/test';

async function register(request) {
  const username = `feedback${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const response = await request.post('/api/auth/register', { data: { username, name: 'Community tester', email: `${username}@example.com`, password: 'correct-password', password_confirmation: 'correct-password' } });
  expect(response.status()).toBe(201);
}
async function admin(request) {
  const response = await request.post('/api/auth/login', { data: { username: 'admin', password: 'correct-password' } });
  expect(response.ok()).toBeTruthy();
}

test('real API: public feedback and admin hide/show', async ({ page, context }) => {
  await register(context.request);
  await page.goto('/feedback');
  const content = `Community suggestion ${Date.now()} <script>alert(1)</script>`;
  await page.getByLabel('Góp ý của bạn', { exact: true }).fill(content);
  await page.getByRole('button', { name: 'Gửi feedback' }).click();
  await expect(page.getByRole('status')).toContainText('Feedback đã được đăng công khai');
  await expect(page.locator('.feedback-entry').getByText(content, { exact: true })).toBeVisible();
  expect(await page.locator('.feedback-entry script').count()).toBe(0);
  await admin(context.request);
  await page.goto('/admin/feedback');
  const entry = page.locator('.feedback-entry').filter({ hasText: content });
  await entry.getByRole('button', { name: 'Ẩn feedback' }).click();
  await expect(entry.getByText('Đã ẩn', { exact: true })).toBeVisible();
  await page.goto('/feedback');
  await expect(page.getByText(content, { exact: true })).toHaveCount(0);
  await page.goto('/admin/feedback');
  await entry.getByRole('button', { name: 'Hiện lại' }).click();
  await page.goto('/feedback');
  await expect(page.getByText(content, { exact: true })).toBeVisible();
});

test('real API: admin uploads QR and message persists publicly', async ({ page, context }) => {
  await admin(context.request);
  await page.goto('/admin/support');
  const content = `Ủng hộ admin phát triển mobile Google Play và App Store ${Date.now()}`;
  await page.getByLabel('Nội dung kêu gọi ủng hộ').fill(content);
  // Generate a valid PNG in-browser to avoid relying on an external image fixture.
  const bytes = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 120; const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 120, 120); ctx.fillStyle = 'black'; ctx.fillRect(20, 20, 80, 80); return canvas.toDataURL().split(',')[1]; });
  await page.getByLabel('Ảnh QR ủng hộ').setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: Buffer.from(bytes, 'base64') });
  await expect(page.getByRole('button', { name: 'Lưu thay đổi' })).toBeEnabled();
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('status')).toHaveText('Đã cập nhật trang ủng hộ.');
  await page.goto('/support');
  await expect(page.getByText(content, { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /Mã QR/ })).toBeVisible();
  expect(await page.getByRole('img', { name: /Mã QR/ }).evaluate(img => img.complete && img.naturalWidth > 0)).toBeTruthy();
  await page.reload();
  await expect(page.getByText(content, { exact: true })).toBeVisible();
});

test('anonymous mobile navigation, version history and QR empty state', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route('**/api/support', route => route.fulfill({ json: { content: 'Ủng hộ admin làm app mobile', qr_url: null, revision: 0 } }));
  await page.goto('/updates');
  await expect(page.getByRole('heading', { name: 'Phiên bản đầu tiên' })).toBeVisible();
  await page.locator('.community-mobile-nav summary').click();
  await page.locator('.community-mobile-nav').getByRole('link', { name: 'Ủng hộ', exact: true }).click();
  await expect(page.getByText('QR ủng hộ chưa được thiết lập.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.goto('/feedback');
  await expect(page.getByRole('link', { name: 'Đăng nhập để góp ý' })).toBeVisible();
  await page.locator('.community-mobile-nav summary').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.locator('.community-mobile-nav a').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.community-mobile-nav summary')).toBeFocused();
});

test('failed submission preserves draft and uses same idempotency key on retry', async ({ page }) => {
  const bodies = [];
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 'user', name: 'Test', username: 'tester' } }));
  await page.route('**/api/feedback?*', route => route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 20 } }));
  await page.route('**/api/feedback', route => { bodies.push(route.request().postDataJSON()); return route.fulfill({ status: 503, json: { detail: 'failed' } }); });
  await page.goto('/feedback');
  await page.getByLabel('Góp ý của bạn', { exact: true }).fill('This is a helpful suggestion');
  await page.getByRole('button', { name: 'Gửi feedback' }).click();
  await expect(page.getByRole('alert')).toContainText('Nội dung bạn nhập vẫn được giữ lại');
  await page.getByRole('button', { name: 'Gửi feedback' }).click();
  await expect(page.getByRole('button', { name: 'Gửi feedback' })).toBeEnabled();
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
});

test('support conflict preserves draft and requires reload', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 'admin', name: 'Admin', username: 'admin', is_admin: true } }));
  await page.route('**/api/admin/support', route => route.request().method() === 'GET' ? route.fulfill({ json: { content: 'Original support message', revision: 0, qr_url: null } }) : route.fulfill({ status: 409, json: { detail: 'conflict' } }));
  await page.goto('/admin/support');
  await page.getByLabel('Nội dung kêu gọi ủng hộ').fill('My unsaved support message');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('alert')).toContainText('admin khác');
  await expect(page.getByLabel('Nội dung kêu gọi ủng hộ')).toHaveValue('My unsaved support message');
  await expect(page.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled();
  await page.getByRole('button', { name: 'Tải lại cấu hình' }).click();
  await expect(page.getByLabel('Nội dung kêu gọi ủng hộ')).toHaveValue('Original support message');
});

test('community pages fit mobile and desktop in all interface languages', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 'admin', name: 'Admin', username: 'admin', is_admin: true } }));
  const list = { items: [], total: 0, page: 1, page_size: 20 };
  const support = { content: 'Support mobile development', qr_url: null, revision: 0 };
  await page.route('**/api/feedback?*', route => route.fulfill({ json: list }));
  await page.route('**/api/admin/feedback?*', route => route.fulfill({ json: list }));
  await page.route('**/api/support', route => route.fulfill({ json: support }));
  await page.route('**/api/admin/support', route => route.fulfill({ json: support }));
  for (const locale of ['vi', 'en', 'zh-CN']) {
    await page.addInitScript(code => localStorage.setItem('transqora.uiLocale', code), locale);
    for (const width of [375, 1600]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/feedback', '/updates', '/support', '/admin/feedback', '/admin/support']) {
        await page.goto(path);
        await expect(page.locator('main h1')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${locale} ${width} ${path}`).toBeTruthy();
        await expect(page.locator('main')).not.toContainText('community.');
      }
    }
  }
});
