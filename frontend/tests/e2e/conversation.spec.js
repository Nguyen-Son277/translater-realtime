import { test, expect } from '@playwright/test';

const accountName = () => `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

async function register(page) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Tạo tài khoản' }).click();
  const username = accountName();
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill(username);
  await page.getByLabel('Mật khẩu', { exact: false }).first().fill('test-password-123');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hiểu nhau, ngay lúc này.' })).toBeVisible();
  return username;
}

async function create(page, mode = 'shared') {
  await page.getByRole('button', { name: 'Tạo cuộc trò chuyện', exact: true }).click();
  if (mode === 'remote') await page.getByRole('radio', { name: /Hai máy riêng/ }).check();
  await page.getByLabel('Tên hội thoại').fill('Cà phê cùng bạn');
  await page.getByRole('button', { name: 'Bắt đầu trò chuyện', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cà phê cùng bạn', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Đã kết nối');
}

async function send(page, side, text) {
  await page.getByRole('textbox', { name: `Tin nhắn người ${side}` }).fill(text);
  await page.getByRole('button', { name: `Gửi tin nhắn người ${side}` }).click();
  await expect(page.getByRole('textbox', { name: `Tin nhắn người ${side}` })).toHaveValue('');
}

test('shared phone shows both languages on both sides and rotates A', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page);
  await page.screenshot({ path: 'test-results/mobile-dashboard.png', fullPage: true });
  await create(page);
  await send(page, 'A', 'Xin chào');
  for (const side of ['A', 'B']) {
    const panel = page.getByRole('log', { name: `Hội thoại người ${side}` });
    await expect(panel.getByText('Xin chào', { exact: true })).toBeVisible();
    await expect(panel.getByText('Hello', { exact: true })).toBeVisible();
  }
  await send(page, 'B', 'How are you?');
  await expect(page.getByText('Bạn khỏe không?', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('log', { name: 'Hội thoại người A' }).locator('.message-text').first()).toHaveText('How are you?');
  await expect(page.getByText('Bạn là A · Tiếng Việt', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Xoay màn hình người A 180 độ' }).click();
  await expect(page.getByRole('button', { name: 'Xoay màn hình người A 180 độ' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Màn hình người A' })).toHaveCSS('transform', 'matrix(-1, 0, 0, -1, 0, 0)');
  await page.screenshot({ path: 'test-results/mobile-shared-room.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('two signed-in phones join by invitation and exchange both directions', async ({ browser }) => {
  const first = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const second = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const a = await first.newPage(), b = await second.newPage();
  await register(a); await create(a, 'remote');
  await a.getByRole('button', { name: 'Mời bạn' }).click();
  await expect(a.getByRole('img', { name: 'QR tham gia phòng Song Ngữ' })).toBeVisible();
  const invitation = await a.getByLabel('Liên kết mời').inputValue();
  await a.getByRole('button', { name: 'Đóng', exact: true }).click();
  await b.goto(invitation);
  await b.getByRole('tab', { name: 'Tạo tài khoản' }).click();
  await b.getByLabel('Tên đăng nhập', { exact: true }).fill(accountName());
  await b.locator('#password').fill('test-password-123');
  await b.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(b.getByRole('heading', { name: 'Cùng một cuộc trò chuyện.' })).toBeVisible();
  await b.getByRole('button', { name: 'Vào phòng', exact: true }).click();
  await expect(b.getByRole('status')).toHaveText('Đã kết nối');
  await expect(b.getByText('Bạn là B · English', { exact: false })).toBeVisible();
  await expect(a.getByText('Đang chờ người còn lại.', { exact: false })).toHaveCount(0);
  await Promise.all([send(a, 'A', 'Xin chào'), send(b, 'B', 'How are you?')]);
  for (const page of [a, b]) {
    await expect(page.getByText('Hello', { exact: true })).toBeVisible();
    await expect(page.getByText('Bạn khỏe không?', { exact: true })).toBeVisible();
    await expect(page.locator('[data-message-id]')).toHaveCount(2);
  }
  await b.reload();
  await expect(b.getByText('Bạn khỏe không?', { exact: true })).toBeVisible();
  await expect(b.locator('[data-message-id]')).toHaveCount(2);
  await first.close(); await second.close();
});

test('microphone denial leaves text conversation usable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => { throw new DOMException('Permission denied', 'NotAllowedError'); },
    });
  });
  await register(page); await create(page);
  await page.getByRole('button', { name: 'Bắt đầu nghe', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('chưa cho phép dùng micro');
  await send(page, 'A', 'Xin chào');
  await expect(page.getByText('Hello', { exact: true })).toHaveCount(2);
});

test('AudioWorklet sends live PCM and stopping commits the last spoken segment', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    // A deterministic live audio source exercises AudioWorklet and WebSocket;
    // only the server's expensive recognizer is replaced by the test adapter.
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => {
        const context = new AudioContext();
        await context.resume();
        const oscillator = context.createOscillator();
        oscillator.type = 'sawtooth'; oscillator.frequency.value = 170;
        const gain = context.createGain(); gain.gain.value = .15;
        const destination = context.createMediaStreamDestination();
        oscillator.connect(gain).connect(destination); oscillator.start();
        window.__audioSource = { context, oscillator };
        return destination.stream;
      },
    });
  });
  await register(page); await create(page);
  await page.screenshot({ path: 'test-results/voice-before.png', fullPage: true });
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.getByRole('button', { name: 'Bắt đầu nghe', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dừng micro', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Màn hình người A' })).toHaveClass(/capturing/);
  await expect(page.getByRole('region', { name: 'Màn hình người B' })).not.toHaveClass(/capturing/);
  await expect(page.getByText('Đang nghe người A…', { exact: false }).first()).toBeVisible({ timeout: 12000 });
  await page.screenshot({ path: 'test-results/voice-listening.png', fullPage: true });
  await page.getByRole('button', { name: 'Dừng micro', exact: true }).click();
  await expect(page.getByText('Hello', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Bắt đầu nghe', exact: true })).toBeVisible();
  await expect(page.getByText('Chọn người nói để dịch câu này:')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Màn hình người A' })).not.toHaveClass(/capturing/);
  await page.evaluate(() => window.__audioSource.context.close());
  expect(errors).toEqual([]);
});

test('reconnecting socket resyncs missed messages without duplication', async ({ page }) => {
  await page.addInitScript(() => {
    const Original = window.WebSocket;
    window.__connections = [];
    window.WebSocket = class extends Original {
      constructor(...args) { super(...args); window.__connections.push(this); }
    };
  });
  await register(page); await create(page);
  await send(page, 'A', 'Xin chào');
  await expect(page.getByText('Hello', { exact: true })).toHaveCount(2);
  await page.evaluate(() => window.__connections.at(-1).close());
  await expect(page.getByRole('status')).toContainText('Đang kết nối lại');
  await send(page, 'B', 'How are you?');
  await expect(page.getByRole('status')).toHaveText('Đã kết nối');
  await expect(page.getByText('Bạn khỏe không?', { exact: true })).toHaveCount(2);
  await expect(page.locator('[data-message-id]')).toHaveCount(4);
});

test('mobile landscape keeps both composers accessible', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await register(page); await create(page);
  for (const side of ['A', 'B']) await expect(page.getByRole('textbox', { name: `Tin nhắn người ${side}` })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('history persists and owner can delete the conversation', async ({ page }) => {
  await register(page); await create(page);
  await send(page, 'A', 'Xin chào');
  await expect(page.getByText('Hello', { exact: true })).toHaveCount(2);
  await page.getByRole('link', { name: 'Về danh sách hội thoại' }).click();
  await page.getByRole('link', { name: /Cà phê cùng bạn/ }).click();
  await expect(page.getByText('Hello', { exact: true })).toHaveCount(2);
  await page.getByRole('link', { name: 'Về danh sách hội thoại' }).click();
  await page.getByRole('button', { name: 'Xóa Cà phê cùng bạn' }).click();
  await page.getByRole('button', { name: 'Xóa hội thoại', exact: true }).click();
  await expect(page.getByRole('link', { name: /Cà phê cùng bạn/ })).toHaveCount(0);
});
