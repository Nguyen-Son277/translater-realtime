import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`translation settings persist without exposing key (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const responses = [];
    page.on('response', response => {
      if (response.url().includes('/api/settings/translation') && response.status() !== 204) {
        responses.push(response.text());
      }
    });
    const username = `settings_${Date.now().toString(36)}_${viewport.width}`;
    await page.goto('/login');
    await page.getByRole('tab', { name: 'Tạo tài khoản' }).click();
    await page.getByLabel('Tên đăng nhập', { exact: true }).fill(username);
    await page.locator('#password').fill('test-password-123');
    await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
    await page.getByRole('link', { name: 'Cài đặt dịch thuật' }).click();
    await expect(page.getByRole('heading', { name: 'Cài đặt dịch thuật' })).toBeVisible();
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await expect(page.getByRole('button', { name: 'Kiểm tra kết nối' })).toBeDisabled();
    await page.getByLabel('Base URL', { exact: true }).fill('https://llm.example/v1/');
    await page.getByLabel('Tên model', { exact: true }).fill('vietnamese-chinese-model');
    await page.getByLabel('API key', { exact: false }).fill('e2e-private-key');
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Đã lưu');
    await expect(page.getByLabel('API key', { exact: false })).toHaveValue('');
    await expect(page.getByText('Đã lưu API key', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Kiểm tra kết nối' }).click();
    await expect(page.getByRole('status')).toContainText('Kết nối thành công');
    await page.getByLabel('Tên model', { exact: true }).fill('replacement-model');
    await expect(page.getByRole('button', { name: 'Kiểm tra kết nối' })).toBeDisabled();
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Đã lưu');
    await page.reload();
    await expect(page.getByLabel('Tên model', { exact: true })).toHaveValue('replacement-model');
    await expect(page.getByText('Đã lưu API key', { exact: true })).toBeVisible();
    await expect(page.getByLabel('API key', { exact: false })).toHaveValue('');
    await page.screenshot({ path: `test-results/settings-${viewport.width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('e2e-private-key');
    await page.getByRole('button', { name: 'Xóa cấu hình', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Xóa cấu hình', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Đã xóa');
    await expect(page.getByLabel('Base URL', { exact: true })).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Kiểm tra kết nối' })).toBeDisabled();
    for (const body of await Promise.all(responses)) {
      expect(body).not.toContain('e2e-private-key');
    }
    expect(errors).toEqual([]);
  });
}
