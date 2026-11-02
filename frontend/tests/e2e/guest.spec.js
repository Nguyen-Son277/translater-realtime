import { test, expect } from '@playwright/test';

async function invitation(context) {
  const username = `guest_${crypto.randomUUID().slice(0, 12)}`;
  expect((await context.request.post('/api/auth/register', { data: {
    username, name: username, email: `${username}@example.com`,
    password: 'test-password-123', password_confirmation: 'test-password-123',
  } })).ok()).toBe(true);
  const room = await (await context.request.post('/api/rooms', { data: { mode: 'remote', title: 'Guest access' } })).json();
  const invite = await (await context.request.post(`/api/rooms/${room.id}/invite`)).json();
  return `/join#token=${invite.token}`;
}

const enter = page => page.getByRole('button', { name: 'Vào phòng', exact: true });

test('optional account sign-in preserves the public invitation', async ({ browser }) => {
  const owner = await browser.newContext(), guest = await browser.newContext();
  try {
    const url = await invitation(owner);
    const username = `member_${crypto.randomUUID().slice(0, 12)}`;
    const response = await guest.request.post('/api/auth/register', { data: {
      username, name: username, email: `${username}@example.com`,
      password: 'test-password-123', password_confirmation: 'test-password-123',
    } });
    expect(response.ok()).toBe(true);
    const member = await response.json();
    await guest.clearCookies();
    const page = await guest.newPage();
    await page.goto(url);
    await page.getByRole('link', { name: 'Đăng nhập', exact: true }).click();
    await page.getByLabel('Tên đăng nhập', { exact: true }).fill(username);
    await page.locator('#password').fill('test-password-123');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page).toHaveURL(parsed => parsed.pathname + parsed.hash === url);
    await enter(page).click();
    await expect(page.getByRole('status')).toHaveText('Đã kết nối');
    expect(await (await guest.request.get('/api/auth/me')).json()).toEqual(member);
  } finally { await owner.close(); await guest.close(); }
});

test('invalid invitation stays public and creates no guest session', async ({ page }) => {
  await page.goto('/join#token=invalid-invitation-token');
  await expect(page.getByLabel('Tên đăng nhập', { exact: true })).toHaveCount(0);
  await enter(page).click();
  await expect(page.getByRole('alert')).toContainText('Lời mời không hợp lệ');
  await expect(page).toHaveURL(/\/join#token=/);
  expect((await page.context().request.get('/api/auth/me')).status()).toBe(401);
});

test('failed session refresh after join retries without consuming invitation twice', async ({ browser }) => {
  const owner = await browser.newContext(), guest = await browser.newContext();
  try {
    const url = await invitation(owner), page = await guest.newPage();
    let joins = 0, failRefresh = false;
    await page.route('**/api/rooms/join', async route => {
      joins += 1;
      const response = await route.fetch();
      failRefresh = true;
      await route.fulfill({ response });
    });
    await page.route('**/api/auth/me', async route => {
      if (failRefresh) {
        failRefresh = false;
        return route.fulfill({ status: 503, json: { detail: 'Temporary session error' } });
      }
      return route.continue();
    });
    await page.goto(url);
    await enter(page).click();
    await expect(page.getByRole('alert')).toHaveText('Temporary session error');
    await page.getByRole('button', { name: 'Thử mở lại phòng' }).click();
    await expect(page.getByRole('status')).toHaveText('Đã kết nối');
    expect(joins).toBe(1);
    expect((await (await guest.request.get('/api/auth/me')).json()).is_guest).toBe(true);
    await guest.clearCookies();
    await page.goto(url); await enter(page).click();
    await expect(page.getByRole('alert')).toContainText('Lời mời không hợp lệ');
    await expect(page).toHaveURL(/\/join#token=/);
  } finally { await owner.close(); await guest.close(); }
});

test('late initial unauthenticated response cannot overwrite the joined guest session', async ({ browser }) => {
  const owner = await browser.newContext(), guest = await browser.newContext();
  try {
    const url = await invitation(owner), page = await guest.newPage();
    await page.addInitScript(() => {
      const nativeFetch = window.fetch;
      let held = false;
      window.fetch = async (...args) => {
        const hold = !held && args[0] === '/api/auth/me';
        if (hold) held = true;
        const response = await nativeFetch(...args);
        if (hold) {
          const body = await response.text();
          return new Promise(resolve => {
            window.__releaseInitialAuth = () => resolve(new Response(body, { status: response.status }));
          });
        }
        return response;
      };
    });
    await page.goto(url);
    await expect.poll(() => page.evaluate(() => typeof window.__releaseInitialAuth)).toBe('function');
    // React StrictMode's second load resolves while the first stale response is held.
    await enter(page).click();
    await expect(page.getByRole('status')).toHaveText('Đã kết nối');
    await page.evaluate(async () => {
      window.__releaseInitialAuth();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await expect(page.getByRole('status')).toHaveText('Đã kết nối');
    await expect(page).toHaveURL(/\/rooms\//);
  } finally { await owner.close(); await guest.close(); }
});
