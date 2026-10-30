import { test, expect } from '@playwright/test';

test('registration checks password confirmation and settings save email across login', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const username = `profile_${Date.now().toString(36)}`;
  const name = 'Nguyễn Sơn';
  const email = `${username}@example.com`;
  const updatedEmail = `updated_${username}@example.com`;
  await page.goto('/');
  await page.getByRole('tab', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill(username);
  await page.getByLabel('Họ và tên', { exact: true }).fill(name);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.locator('#password').fill('test-password-123');
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('different-password');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Mật khẩu nhập lại chưa khớp.');
  await expect(page).toHaveURL(/\/login$/);
  await page.screenshot({ path: 'test-results/account-registration-mobile.png', fullPage: true });
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hiểu nhau, ngay lúc này.' })).toBeVisible();
  await expect(page.getByText(`Xin chào ${name}.`, { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Cài đặt tài khoản' }).click();
  const dialog = page.getByRole('dialog', { name: 'Cài đặt tài khoản' });
  await expect(dialog.getByText(name, { exact: true })).toBeVisible();
  await expect(dialog.getByText(username, { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Email', { exact: true })).toHaveValue(email);
  await dialog.getByLabel('Email', { exact: true }).fill(updatedEmail);
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Đã cập nhật email.');
  await page.screenshot({ path: 'test-results/account-settings-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: 'Cài đặt tài khoản' }).click();
  await expect(dialog.getByLabel('Email', { exact: true })).toHaveValue(updatedEmail);
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Đăng nhập' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Họ và tên', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Nhập lại mật khẩu', { exact: true })).toHaveCount(0);
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill(username);
  await page.locator('#password').fill('test-password-123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByRole('button', { name: 'Cài đặt tài khoản' }).click();
  await expect(dialog.getByLabel('Email', { exact: true })).toHaveValue(updatedEmail);
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Cài đặt tài khoản' })).toBeFocused();
});

test('elder-friendly typography and account screens fit narrow widths', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  await expect(page.locator('body')).toHaveCSS('font-size', '18px');
  await page.getByRole('tab', { name: 'Tạo tài khoản' }).click();
  await expect(page.getByRole('button', { name: 'Tạo tài khoản', exact: true })).toHaveCSS('font-size', '18px');
  await expect(page.getByLabel('Tên đăng nhập', { exact: true })).toHaveCSS('font-size', '20px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const username = `responsive_${Date.now().toString(36)}`;
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill(username);
  await page.getByLabel('Họ và tên', { exact: true }).fill('Nguyễn Sơn');
  await page.getByLabel('Email', { exact: true }).fill(`${username}@example.com`);
  await page.locator('#password').fill('test-password-123');
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hiểu nhau, ngay lúc này.' })).toBeVisible();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 700 });
  await page.getByRole('button', { name: 'Tạo cuộc trò chuyện', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
});
