import { test, expect } from '@playwright/test';

const ADMIN_PASSWORD = 'e2e-admin-password-123';
const USER_PASSWORD = 'e2e-user-password-123';
const dashboard = page => page.getByRole('heading', { name: 'Hiểu nhau, ngay lúc này.' });
const accountRow = (page, username) => page.locator('tr:visible, article.admin-card:visible').filter({ has: page.getByText(`@${username}`, { exact: true }) });

async function register(page, username, password, name = 'Người dùng kiểm thử') {
  await page.goto('/login');
  await page.getByRole('tab', { name: 'Tạo tài khoản', exact: true }).click();
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill(username);
  await page.getByLabel('Họ và tên', { exact: true }).fill(name);
  await page.getByLabel('Email', { exact: true }).fill(`${username}@example.com`);
  await page.locator('#password').fill(password);
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill(password);
  const response = page.waitForResponse(response => response.url().endsWith('/api/auth/register') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  return response;
}

async function login(page, username, password) {
  await page.goto('/login');
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
}

async function signInAdmin(page) {
  const response = await register(page, 'admin', ADMIN_PASSWORD, 'Quản trị kiểm thử');
  if (response.status() === 409) {
    await page.getByRole('alert').waitFor();
    await login(page, 'admin', ADMIN_PASSWORD);
  } else {
    expect(response.ok(), await response.text()).toBe(true);
  }
  await expect(dashboard(page)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Quản trị', exact: true })).toBeVisible();
}

async function assertFits(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function changePassword(page, current, next) {
  await page.getByLabel('Mật khẩu hiện tại', { exact: true }).fill(current);
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill(next);
  await page.getByLabel('Nhập lại mật khẩu mới', { exact: true }).fill(next);
  await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click();
  await expect(dashboard(page)).toBeVisible();
}

async function confirmAction(page, row, action, title, confirm = action) {
  await row.getByRole('button', { name: action, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: confirm, exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Thao tác thành công.');
}

test('admin searches, filters, locks, resets and deletes an account across isolated sessions', async ({ page, browser, baseURL }, testInfo) => {
  test.setTimeout(120000);
  const username = `admin_user_${Date.now().toString(36)}`;
  const temporaryPassword = 'temporary-password-123';
  const finalPassword = 'changed-user-password-123';
  const userContext = await browser.newContext({ baseURL });
  const userPage = await userContext.newPage();
  try {
    expect((await register(userPage, username, USER_PASSWORD)).ok()).toBe(true);
    await expect(dashboard(userPage)).toBeVisible();
    await expect(userPage.getByRole('link', { name: 'Quản trị', exact: true })).toHaveCount(0);
    await userPage.goto('/admin');
    await expect(userPage).toHaveURL(`${baseURL}/`);
    await expect(dashboard(userPage)).toBeVisible();
    await expect(userPage.getByRole('heading', { name: 'Quản lý tài khoản' })).toHaveCount(0);

    await signInAdmin(page);
    await page.getByRole('link', { name: 'Quản trị', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Quản lý tài khoản' })).toBeVisible();
    const search = page.getByRole('searchbox', { name: 'Tìm kiếm tài khoản' });
    const role = page.getByRole('combobox', { name: 'Vai trò', exact: true });
    const status = page.getByRole('combobox', { name: 'Trạng thái', exact: true });
    const row = accountRow(page, username);
    await search.fill(`${username}@example.com`);
    await expect(row).toHaveCount(1);
    await role.selectOption('admin');
    await expect(page.getByText('Không có tài khoản nào phù hợp với bộ lọc hiện tại.')).toBeVisible();
    await role.selectOption('user');
    await expect(row).toBeVisible();
    await status.selectOption('locked');
    await expect(row).toHaveCount(0);
    await expect(page.getByText('Không có tài khoản nào phù hợp với bộ lọc hiện tại.')).toBeVisible();
    await status.selectOption('active');
    await expect(row).toBeVisible();
    await search.fill(username);

    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(row).toBeVisible();
      await expect(row.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true })).toBeVisible();
      await assertFits(page);
      await page.screenshot({ path: testInfo.outputPath(`admin-accounts-${width}.png`), fullPage: true });
      await row.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect.poll(() => dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await assertFits(page);
      await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
    }

    await status.selectOption('all');
    await expect(row).toBeVisible();
    await confirmAction(page, row, 'Khóa tài khoản', 'Khóa tài khoản');
    await expect(row.getByText('Đã khóa', { exact: true })).toBeVisible();
    await userPage.reload();
    await expect(userPage).toHaveURL(/\/login$/);
    await login(userPage, username, USER_PASSWORD);
    await expect(userPage.getByRole('alert')).toBeVisible();
    await expect(userPage).toHaveURL(/\/login$/);
    await status.selectOption('locked');
    await expect(row).toBeVisible();
    await confirmAction(page, row, 'Mở khóa', 'Mở khóa tài khoản');
    await expect(row).toHaveCount(0);
    await status.selectOption('active');
    await expect(row.getByText('Hoạt động', { exact: true })).toBeVisible();
    await login(userPage, username, USER_PASSWORD);
    await expect(dashboard(userPage)).toBeVisible();

    await row.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true }).click();
    const resetDialog = page.getByRole('dialog', { name: `Đặt lại mật khẩu cho ${username}`, exact: true });
    await resetDialog.getByLabel('Mật khẩu mới', { exact: true }).fill(temporaryPassword);
    await resetDialog.getByLabel('Nhập lại mật khẩu mới', { exact: true }).fill('mismatched-password');
    await resetDialog.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true }).click();
    await expect(resetDialog.getByRole('alert')).toHaveText('Mật khẩu nhập lại chưa khớp.');
    await resetDialog.getByLabel('Nhập lại mật khẩu mới', { exact: true }).fill(temporaryPassword);
    await resetDialog.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true }).click();
    await expect(resetDialog).not.toBeVisible();
    await expect(row.getByText('Cần đổi MK', { exact: true })).toBeVisible();
    await userPage.reload();
    await expect(userPage).toHaveURL(/\/login$/);
    await login(userPage, username, USER_PASSWORD);
    await expect(userPage.getByRole('alert')).toBeVisible();
    await login(userPage, username, temporaryPassword);
    await expect(userPage).toHaveURL(/\/change-password$/);
    await expect(userPage.getByRole('status')).toContainText('Quản trị viên đã đặt lại mật khẩu');
    await userPage.goto('/');
    await expect(userPage).toHaveURL(/\/change-password$/);
    await expect(userPage.getByRole('button', { name: 'Hủy', exact: true })).toHaveCount(0);
    for (const width of [320, 390, 1280]) {
      await userPage.setViewportSize({ width, height: 844 });
      await expect(userPage.getByLabel('Mật khẩu hiện tại', { exact: true })).toBeVisible();
      await assertFits(userPage);
      await userPage.screenshot({ path: testInfo.outputPath(`forced-password-${width}.png`), fullPage: true });
    }
    await changePassword(userPage, temporaryPassword, finalPassword);
    await userPage.reload();
    await expect(dashboard(userPage)).toBeVisible();
    await userPage.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await login(userPage, username, temporaryPassword);
    await expect(userPage.getByRole('alert')).toBeVisible();
    await login(userPage, username, finalPassword);
    await expect(dashboard(userPage)).toBeVisible();
    await page.reload();
    await search.fill(username);
    await expect(row).toBeVisible();
    await expect(row.getByText('Cần đổi MK', { exact: true })).toHaveCount(0);
    await confirmAction(page, row, 'Xóa tài khoản', 'Xóa tài khoản', 'Xóa vĩnh viễn');
    await expect(row).toHaveCount(0);
    await expect(page.getByText('Không có tài khoản nào phù hợp với bộ lọc hiện tại.')).toBeVisible();
    await userPage.reload();
    await expect(userPage).toHaveURL(/\/login$/);
    await login(userPage, username, finalPassword);
    await expect(userPage.getByRole('alert')).toBeVisible();
  } finally {
    await userContext.close();
  }
});

test('admin changes own password with validation and restores the original credential', async ({ page }) => {
  test.setTimeout(60000);
  const changedPassword = 'changed-admin-password-123';
  let changed = false;
  await signInAdmin(page);
  try {
    await page.getByRole('button', { name: 'Cài đặt tài khoản', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Cài đặt tài khoản', exact: true });
    await settings.getByRole('link', { name: 'Đổi mật khẩu', exact: true }).click();
    await expect(page).toHaveURL(/\/change-password$/);
    await page.getByLabel('Mật khẩu hiện tại', { exact: true }).fill(ADMIN_PASSWORD);
    await page.getByLabel('Mật khẩu mới', { exact: true }).fill(changedPassword);
    await page.getByLabel('Nhập lại mật khẩu mới', { exact: true }).fill('mismatched-password');
    await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Mật khẩu nhập lại chưa khớp.');
    await page.getByLabel('Mật khẩu mới', { exact: true }).fill(ADMIN_PASSWORD);
    await page.getByLabel('Nhập lại mật khẩu mới', { exact: true }).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Mật khẩu mới phải khác mật khẩu hiện tại.');
    await changePassword(page, ADMIN_PASSWORD, changedPassword);
    changed = true;
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await login(page, 'admin', ADMIN_PASSWORD);
    await expect(page.getByRole('alert')).toBeVisible();
    await login(page, 'admin', changedPassword);
    await expect(dashboard(page)).toBeVisible();
    await page.goto('/change-password');
    await changePassword(page, changedPassword, ADMIN_PASSWORD);
    changed = false;
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await login(page, 'admin', ADMIN_PASSWORD);
    await expect(dashboard(page)).toBeVisible();
    await page.getByRole('link', { name: 'Quản trị', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Tìm kiếm tài khoản' }).fill('admin@example.com');
    const row = accountRow(page, 'admin');
    await expect(row).toBeVisible();
    await expect(row.getByText('Không thể thao tác trên tài khoản admin', { exact: true })).toBeVisible();
    await expect(row.getByRole('button')).toHaveCount(0);
  } finally {
    // Preserve the shared disposable admin fixture even if an assertion fails.
    if (changed) {
      const loginResponse = await page.request.post('/api/auth/login', { data: { username: 'admin', password: changedPassword } });
      expect(loginResponse.ok()).toBe(true);
      const restore = await page.request.post('/api/auth/password', { data: { current_password: changedPassword, new_password: ADMIN_PASSWORD, new_password_confirmation: ADMIN_PASSWORD } });
      expect(restore.ok()).toBe(true);
    }
  }
});
