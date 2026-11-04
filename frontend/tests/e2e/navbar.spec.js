import { test, expect } from '@playwright/test';
import { SUPPORTED_LOCALES, translations } from '../../src/locales/index.js';
import { openHeaderMenu as openMenu } from './helpers/navigation.js';

const longName = 'Nguyễn Văn Người Dùng Có Tên Rất Dài '.repeat(5);
const accounts = {
  anonymous: null,
  guest: { id: 'guest', username: 'guest', is_guest: true },
  member: { id: 'member', username: 'member', name: longName, email: 'member@example.com' },
  admin: { id: 'admin', username: 'admin', name: longName, email: 'admin@example.com', is_admin: true },
};
const widths = [320, 375, 390, 768, 1024, 1400, 1401, 1440, 1920];

async function mockAccount(page, account = accounts.member) {
  await page.route('**/api/auth/me', route => route.fulfill(account
    ? { json: account }
    : { status: 401, json: { detail: 'Not authenticated' } }));
  await page.route('**/api/rooms', route => route.fulfill({ json: [] }));
}
async function noHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const header = page.locator('.site-header');
  expect(await header.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
}

for (const [role, account] of Object.entries(accounts)) {
  for (const { code } of SUPPORTED_LOCALES) {
    test(`${role} navbar reflows across breakpoints in ${code}`, async ({ page }) => {
      test.setTimeout(60000);
      await mockAccount(page, account);
      await page.goto('/updates');
      await openMenu(page);
      await page.locator('.site-header select').selectOption(code);
      const t = key => translations[code][key];
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        const toggle = page.locator('.header-menu-toggle');
        if (width <= 1400) {
          if (await toggle.getAttribute('aria-expanded') === 'true') await toggle.click();
          await expect(page.locator('.header-right')).toBeHidden();
          const box = await page.locator('.site-header').boundingBox();
          expect(box.height).toBeLessThanOrEqual(90);
          await toggle.focus();
          await page.keyboard.press('Tab');
          expect(await page.locator('.header-right').evaluate(el => el.contains(document.activeElement))).toBe(false);
          await toggle.click();
          await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        } else {
          await expect(toggle).toBeHidden();
        }
        const panel = page.locator('.header-right');
        await expect(panel).toBeVisible();
        await expect(panel.getByRole('link', { name: t('guide.nav'), exact: true })).toBeVisible();
        await expect(panel.getByRole('link', { name: t('community.updates'), exact: true })).toHaveAttribute('aria-current', 'page');
        await expect(panel.getByRole('link', { name: t('common.adminNav'), exact: true })).toHaveCount(role === 'admin' ? 1 : 0);
        await expect(panel.getByRole('button', { name: t('common.settings'), exact: true })).toHaveCount(['member', 'admin'].includes(role) ? 1 : 0);
        await expect(panel.getByRole('button', { name: t('common.logout'), exact: true })).toHaveCount(account ? 1 : 0);
        await expect(panel.getByRole('link', { name: t('auth.login'), exact: true })).toHaveCount(['anonymous', 'guest'].includes(role) ? 1 : 0);
        await noHorizontalOverflow(page);
        expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        for (const target of await panel.locator('a, button, select').all()) {
          const box = await target.boundingBox();
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        }
      }
    });
  }
}

test('menu supports keyboard, outside click, same-page links, route changes and resizing', async ({ page }) => {
  await mockAccount(page, { ...accounts.member, name: 'Test Member' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/updates');
  const toggle = page.locator('.header-menu-toggle');
  const panel = page.locator('.header-right');
  await expect(toggle).toBeVisible();
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(panel.locator('a').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(panel).toBeHidden();
  await openMenu(page);
  await panel.getByRole('link', { name: 'Lịch sử phiên bản', exact: true }).click();
  await expect(panel).toBeHidden();
  await openMenu(page);
  await panel.getByRole('link', { name: 'Hướng dẫn sử dụng', exact: true }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(panel).toBeHidden();
  await openMenu(page);
  // Choose a viewport point below the panel, without scrolling the page.
  const panelBox = await panel.boundingBox();
  expect(panelBox.y + panelBox.height).toBeLessThan(824);
  await page.mouse.click(4, panelBox.y + panelBox.height + 10);
  await expect(panel).toBeHidden();
  await openMenu(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(panel).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel).toBeHidden();
});

test('settings returns focus to the visible header control', async ({ page }) => {
  await mockAccount(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/updates');
  await openMenu(page);
  await page.locator('.header-right').getByRole('button', { name: 'Cài đặt tài khoản', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.header-right')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('.header-menu-toggle')).toBeFocused();
  await openMenu(page);
  await page.locator('.header-right').getByRole('button', { name: 'Cài đặt tài khoản', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.keyboard.press('Escape');
  await expect(page.locator('.header-right').getByRole('button', { name: 'Cài đặt tài khoản', exact: true })).toBeFocused();
});

test('logout failure stays readable and duplicate requests are prevented', async ({ page }) => {
  await mockAccount(page);
  let finish;
  let requests = 0;
  const pending = new Promise(resolve => { finish = resolve; });
  await page.route('**/api/auth/logout', async route => {
    requests++;
    await pending;
    await route.fulfill({ status: 503, json: { detail: 'Không thể đăng xuất. '.repeat(12) } });
  });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/updates');
  await openMenu(page);
  const logout = page.locator('.header-right').getByRole('button', { name: 'Đăng xuất', exact: true });
  await logout.click();
  await expect(logout).toBeDisabled();
  expect(requests).toBe(1);
  finish();
  await expect(page.locator('.header-error')).toBeVisible();
  await expect(logout).toBeEnabled();
  await page.locator('.header-menu-toggle').click();
  await expect(page.locator('.header-error')).toBeVisible();
  await noHorizontalOverflow(page);
});

test('short screens and enlarged text keep every menu control reachable', async ({ page }) => {
  await mockAccount(page, accounts.admin);
  await page.goto('/updates');
  for (const width of [320, 768, 1401, 1920]) {
    await page.setViewportSize({ width, height: 480 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await openMenu(page);
    await noHorizontalOverflow(page);
    const panel = page.locator('.header-right');
    expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    if (width <= 1400) {
      const box = await panel.boundingBox();
      expect(box.y + box.height).toBeLessThanOrEqual(481);
      const logout = panel.getByRole('button', { name: 'Đăng xuất', exact: true });
      await logout.scrollIntoViewIfNeeded();
      const buttonBox = await logout.boundingBox();
      expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(481);
      await page.locator('.header-menu-toggle').click();
    }
  }
});

test('capture representative navbar layouts', async ({ page }, testInfo) => {
  await mockAccount(page, { ...accounts.admin, name: 'Nguyễn Minh Anh' });
  await page.goto('/');
  await expect(page.locator('.welcome-section')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await noHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`navbar-${width}.png`) });
    if (width === 390) {
      await openMenu(page);
      await page.screenshot({ path: testInfo.outputPath('navbar-mobile-open.png') });
      await page.keyboard.press('Escape');
    }
  }
});

test('main pages do not introduce page-level horizontal scrolling on phones', async ({ page }) => {
  await mockAccount(page, accounts.admin);
  await page.route('**/api/feedback?*', route => route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 20 } }));
  await page.route('**/api/support', route => route.fulfill({ json: { content: 'Ủng hộ dự án', qr_url: null, revision: 0 } }));
  await page.route('**/api/admin/accounts?*', route => route.fulfill({ json: { items: [], total: 0 } }));
  await page.route('**/api/admin/settings/translation', route => route.fulfill({ json: { base_url: '', model: '', api_key_configured: false, configured: false, revision: 0 } }));
  await page.route('**/api/admin/settings/speech', route => route.fulfill({ json: { silence_ms: 1400, max_segment_ms: 8000, preview_ms: 1000, revision: 0 } }));
  for (const path of ['/', '/join', '/guide', '/guide/so-sanh', '/feedback', '/support', '/updates', '/admin', '/admin/settings', '/change-password']) {
    await page.goto(path);
    await expect(page.locator('.site-header')).toBeVisible();
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await noHorizontalOverflow(page);
    }
  }
});
