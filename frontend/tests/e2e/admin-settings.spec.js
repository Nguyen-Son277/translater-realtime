import { test, expect } from '@playwright/test';

const endpoint = '/api/admin/settings/translation';
const initial = { base_url: 'https://gateway.example/v1', model: 'translator-1', api_key_configured: true, configured: true, revision: 7 };
const admin = { id: 1, username: 'admin', name: 'Admin', is_admin: true, is_guest: false, must_change_password: false };
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function mockSettings(page, options = {}) {
  let saved = { ...initial, ...options.initial };
  const patches = [];
  const tests = [];
  await page.route('**/api/auth/me', route => options.anonymous ? json(route, { detail: 'Unauthorized' }, 401) : json(route, options.user || admin));
  await page.route('**/api/rooms', route => json(route, []));
  await page.route('**/api/admin/accounts?*', route => json(route, { items: [], total: 0 }));
  await page.route(`**${endpoint}`, async route => {
    if (route.request().method() === 'GET') return json(route, saved, options.loadFailure ? 503 : 200);
    const body = route.request().postDataJSON();
    patches.push(body);
    if (options.conflict) {
      saved = { ...saved, model: 'updated-elsewhere', revision: 8 };
      return json(route, { detail: 'revision_conflict' }, 409);
    }
    if (options.saveFailure) return json(route, { detail: 'upstream secret should never render' }, 422);
    saved = { ...saved, ...body, revision: saved.revision + 1 };
    if ('api_key' in body) saved.api_key_configured = body.api_key !== '';
    saved.configured = Boolean(saved.base_url && saved.model);
    // Even an accidental backend credential must never populate the field.
    return json(route, { ...saved, api_key: 'never-show-this-saved-secret' });
  });
  await page.route(`**${endpoint}/test`, route => {
    tests.push(route.request());
    return options.testFailure ? json(route, { detail: options.testFailure }, 502) : json(route, { status: 'ok' });
  });
  return { patches, tests };
}

async function openSettings(page) {
  await page.goto('/admin');
  await page.getByRole('link', { name: 'Cài đặt hệ thống', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await expect(page.getByLabel('URL gốc của API')).toHaveValue(initial.base_url);
}

test('settings navigation preserves, replaces, and explicitly clears the saved API key', async ({ page }) => {
  const { patches, tests } = await mockSettings(page);
  await openSettings(page);
  const key = page.getByLabel('Khóa API mới', { exact: true });
  const save = page.getByRole('button', { name: 'Lưu cấu hình', exact: true });
  const connection = page.getByRole('button', { name: 'Kiểm tra kết nối', exact: true });
  await expect(key).toHaveAttribute('type', 'password');
  await expect(key).toHaveValue('');
  await expect(save).toBeDisabled();
  await page.getByLabel('Mô hình', { exact: true }).fill('translator-2');
  await expect(connection).toBeDisabled();
  await save.click();
  await expect(page.getByRole('status')).toContainText('Đã lưu cấu hình.');
  expect(patches[0]).toEqual({ base_url: initial.base_url, model: 'translator-2', revision: 7 });
  await expect(key).toHaveValue('');
  await expect(page.locator('body')).not.toContainText('never-show-this-saved-secret');
  await key.fill('new-private-key');
  await save.click();
  await expect(key).toHaveValue('');
  expect(patches[1]).toEqual({ base_url: initial.base_url, model: 'translator-2', revision: 8, api_key: 'new-private-key' });
  await connection.click();
  await expect(page.getByRole('status')).toHaveText('Kết nối dịch vụ dịch thành công.');
  expect(tests).toHaveLength(1);
  expect(tests[0].postData()).toBeNull();
  await page.getByLabel('Xóa khóa API đã lưu khi lưu thay đổi').check();
  await expect(key).toBeDisabled();
  await expect(page.getByText('Sau khi lưu, dịch vụ sẽ gửi yêu cầu không kèm khóa API.')).toBeVisible();
  await save.click();
  await expect(page.getByText('Chưa lưu khóa API.')).toBeVisible();
  expect(patches[2].api_key).toBe('');
  await expect(connection).toBeEnabled();
  await page.getByLabel('URL gốc của API').fill('');
  await save.click();
  await expect(page.getByText('Chưa cấu hình', { exact: true })).toBeVisible();
  await expect(connection).toBeDisabled();
});

test('revision conflict preserves draft and requires explicit reload before saving again', async ({ page }) => {
  const { patches } = await mockSettings(page, { conflict: true });
  await openSettings(page);
  await page.getByLabel('Mô hình', { exact: true }).fill('my-draft');
  await page.getByRole('button', { name: 'Lưu cấu hình' }).click();
  await expect(page.getByRole('alert')).toContainText('quản trị viên khác cập nhật');
  await expect(page.getByLabel('Mô hình', { exact: true })).toHaveValue('my-draft');
  await expect(page.getByRole('button', { name: 'Lưu cấu hình' })).toBeDisabled();
  await page.getByRole('button', { name: 'Tải lại cấu hình' }).click();
  await expect(page.getByLabel('Mô hình', { exact: true })).toHaveValue('updated-elsewhere');
  expect(patches).toHaveLength(1);
});

test('load errors are recoverable and save errors do not expose server details', async ({ page }) => {
  await mockSettings(page, { loadFailure: true });
  await page.goto('/admin/settings');
  await expect(page.getByRole('alert')).toContainText('Không tải được cấu hình.');
  await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
  await page.unroute(`**${endpoint}`);
  await mockSettings(page, { saveFailure: true });
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await page.getByLabel('Mô hình', { exact: true }).fill('draft');
  await page.getByRole('button', { name: 'Lưu cấu hình' }).click();
  await expect(page.getByRole('alert')).toContainText('Không lưu được cấu hình.');
  await expect(page.getByLabel('Mô hình', { exact: true })).toHaveValue('draft');
  await expect(page.locator('body')).not.toContainText('upstream secret');
});

for (const [code, message] of [['upstream_auth', 'Dịch vụ dịch không chấp nhận khóa API.'], ['timeout', 'Kiểm tra kết nối quá thời gian. Hãy thử lại.'], ['untrusted-secret-detail', 'Không kiểm tra được kết nối. Vui lòng thử lại.']]) {
  test(`test connection renders safe localized error for ${code}`, async ({ page }) => {
    await mockSettings(page, { testFailure: code });
    await openSettings(page);
    await page.getByRole('button', { name: 'Kiểm tra kết nối' }).click();
    await expect(page.getByRole('alert')).toHaveText(message);
    await expect(page.locator('body')).not.toContainText('untrusted-secret-detail');
  });
}

test('settings fit mobile and desktop in every interface locale', async ({ page }, testInfo) => {
  await mockSettings(page);
  await openSettings(page);
  for (const locale of ['vi', 'en', 'zh-CN']) {
    await page.locator('.language-select').selectOption(locale);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.locator('#translation-base-url')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`admin-settings-${locale}-${width}.png`), fullPage: true });
    }
  }
});

test('non-admin users cannot enter settings and anonymous users must sign in', async ({ page }) => {
  await mockSettings(page, { user: { ...admin, is_admin: false } });
  await page.goto('/admin/settings');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Quản trị', exact: true })).toHaveCount(0);
  await page.unroute('**/api/auth/me');
  await page.route('**/api/auth/me', route => json(route, { detail: 'Unauthorized' }, 401));
  await page.goto('/admin/settings');
  await expect(page).toHaveURL(/\/login$/);
});
