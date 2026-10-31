import { test, expect } from '@playwright/test';

test('auth page allows switching between Vietnamese, English, and Chinese, and preserves choice across reloads', async ({ page }) => {
  await page.goto('/login');

  // Default is Vietnamese
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.getByRole('tab', { name: 'Đăng nhập' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Tạo tài khoản' })).toBeVisible();
  await expect(page.getByLabel('Tên đăng nhập', { exact: true })).toBeVisible();

  // Switch to English
  const authLangSelect = page.getByRole('combobox', { name: 'Chọn ngôn ngữ giao diện' });
  await authLangSelect.selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('tab', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Create account' })).toBeVisible();
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Enter password')).toBeVisible();

  // Switch to Chinese
  const enLangSelect = page.getByRole('combobox', { name: 'Select interface language' });
  await enLangSelect.selectOption('zh-CN');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await expect(page.getByRole('tab', { name: '登录' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '创建账户' })).toBeVisible();
  await expect(page.getByLabel('用户名', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('输入密码')).toBeVisible();

  // Reload page to verify persistence in localStorage
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await expect(page.getByRole('tab', { name: '登录' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '创建账户' })).toBeVisible();

  // Reset back to Vietnamese
  const zhLangSelect = page.getByRole('combobox', { name: '选择界面语言' });
  await zhLangSelect.selectOption('vi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.getByRole('tab', { name: 'Đăng nhập' })).toBeVisible();
});

test('dashboard and room reflect language changes across screens without horizontal overflow', async ({ page }) => {
  const username = `i18n_user_${Date.now().toString(36)}`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/login');

  // Register in Vietnamese
  await page.getByRole('tab', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill(username);
  await page.getByLabel('Họ và tên', { exact: true }).fill('Người Dùng Test');
  await page.getByLabel('Email', { exact: true }).fill(`${username}@example.com`);
  await page.locator('#password').fill('test-password-123');
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();

  // Dashboard in Vietnamese
  await expect(page.getByRole('heading', { name: 'Hiểu nhau, ngay lúc này.' })).toBeVisible();

  // Change to English via Header selector
  await page.getByRole('combobox', { name: 'Chọn ngôn ngữ giao diện' }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Understand each other, right here, right now.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create conversation' })).toBeVisible();

  // Check responsiveness on narrow screens in English
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }

  // Restore desktop size to check modal
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: 'Create conversation' }).click();
  const createModal = page.getByRole('dialog', { name: 'A new conversation' });
  await expect(createModal).toBeVisible();
  await expect(createModal.getByText('One shared device')).toBeVisible();
  await expect(createModal.getByText('Two separate devices')).toBeVisible();

  // Switch to Chinese while in Dashboard
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'Select interface language' }).selectOption('zh-CN');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await expect(page.getByRole('heading', { name: '理解彼此， 就在此刻。' })).toBeVisible();
  await expect(page.getByRole('button', { name: '创建对话' })).toBeVisible();

  // Create room
  await page.getByRole('button', { name: '创建对话' }).click();
  const zhCreateModal = page.getByRole('dialog', { name: '新建对话' });
  await expect(zhCreateModal).toBeVisible();
  await zhCreateModal.getByRole('button', { name: '开始对话' }).click();

  // Wait for room to open
  await page.waitForURL(/\/rooms\/[a-f0-9-]+$/);
  await expect(page.getByRole('button', { name: '开始聆听' })).toBeVisible();

  // Room header language switch to English
  const roomLangSelect = page.getByRole('combobox', { name: '选择界面语言' });
  await roomLangSelect.selectOption('en');
  await expect(page.getByRole('button', { name: 'Start listening' })).toBeVisible();
  await expect(page.getByText('Take turns speaking')).toBeVisible();

  // Switch back to Vietnamese while on desktop to verify text
  await page.getByRole('combobox', { name: 'Select interface language' }).selectOption('vi');
  await expect(page.getByRole('button', { name: 'Bắt đầu nghe' })).toBeVisible();
  await expect(page.getByText('Hai người nói lần lượt')).toBeVisible();

  // Check responsiveness in room at narrow widths without horizontal overflow
  for (const width of [320, 390, 800]) {
    await page.setViewportSize({ width, height: 700 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
