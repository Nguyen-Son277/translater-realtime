import { test, expect } from '@playwright/test';

const accountName = () => `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

async function register(page) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Tạo tài khoản' }).click();
  const username = accountName();
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill(username);
  await page.getByLabel('Họ và tên', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(`${username}@example.com`);
  await page.getByLabel('Mật khẩu', { exact: false }).first().fill('test-password-123');
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('test-password-123');
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

// API-seeded messages provide transcript fixtures without adding text input to the UI.
async function seedTranscriptMessage(page, side, text) {
  const roomId = new URL(page.url()).pathname.split('/').pop();
  const response = await page.context().request.post(`/api/rooms/${roomId}/messages`, {
    data: { text, speaker: side, client_message_id: crypto.randomUUID() },
  });
  if (!response.ok()) throw new Error(`message request failed: ${response.status()}`);
  return response.json();
}

test('shared phone shows one voice transcript with matching original and translated text font sizes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page);
  await create(page);
  await expect(page.getByRole('log')).toHaveCount(1);
  await expect(page.locator('.conversation-panel')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Xoay màn hình/ })).toHaveCount(0);
  await seedTranscriptMessage(page, 'A', 'Xin chào');
  const panel = page.getByRole('log', { name: 'Hội thoại chung' });
  await expect(panel.getByText('Xin chào', { exact: true })).toBeVisible();
  await expect(panel.getByText('Hello', { exact: true })).toBeVisible();
  await seedTranscriptMessage(page, 'B', 'How are you?');
  await expect(panel.getByText('Bạn khỏe không?', { exact: true })).toBeVisible();
  await expect(page.locator('[data-message-id]')).toHaveCount(2);
  for (const translation of await panel.locator('.message-translation').all()) {
    await expect(translation).toHaveCSS('font-size', '22px');
  }
  await expect(page.locator('textarea[aria-label^="Tin nhắn người "]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bắt đầu nghe', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-shared-room.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const translation of await panel.locator('.message-translation').all()) {
    await expect(translation).toHaveCSS('font-size', '24px');
  }
  await expect(page.getByRole('log')).toHaveCount(1);
  await expect(panel.locator('.message-text.preferred')).toHaveCSS('font-size', '24px');
  await expect(page.getByRole('button', { name: 'Bắt đầu nghe', exact: true })).toHaveCSS('min-height', '56px');
  await expect(page.locator('body')).toHaveCSS('font-size', '18px');
});

for (const signedIn of [false, true]) test(`two phones exchange both directions with ${signedIn ? 'a signed-in member' : 'an anonymous guest'}`, async ({ browser }) => {
  const first = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const second = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const a = await first.newPage(), b = await second.newPage();
  await register(a); await create(a, 'remote');
  await a.getByRole('button', { name: 'Mời bạn' }).click();
  await expect(a.getByRole('img', { name: 'QR tham gia phòng Song Ngữ' })).toBeVisible();
  const invitation = await a.getByLabel('Liên kết mời').inputValue();
  await a.getByRole('button', { name: 'Đóng', exact: true }).click();
  if (signedIn) await register(b);
  await b.goto(invitation);
  await expect(b.getByRole('tab', { name: 'Tạo tài khoản' })).toHaveCount(0);
  await expect(b.getByRole('heading', { name: 'Cùng một cuộc trò chuyện.' })).toBeVisible();
  await b.getByRole('button', { name: 'Vào phòng', exact: true }).click();
  await expect(b.getByRole('status')).toHaveText('Đã kết nối');
  for (const page of [a, b]) {
    await expect(page.locator('textarea[aria-label^="Tin nhắn người "]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Bắt đầu nghe', exact: true })).toBeVisible();
  }
  await expect(a.getByText('Đang chờ người còn lại.', { exact: false })).toHaveCount(0);
  await Promise.all([seedTranscriptMessage(a, 'A', 'Xin chào'), seedTranscriptMessage(b, 'B', 'How are you?')]);
  for (const page of [a, b]) {
    await expect(page.getByText('Hello', { exact: true })).toBeVisible();
    await expect(page.getByText('Bạn khỏe không?', { exact: true })).toBeVisible();
    await expect(page.locator('[data-message-id]')).toHaveCount(2);
    await expect(page.locator('textarea[aria-label^="Tin nhắn người "]')).toHaveCount(0);
    await expect(page.locator('.message-text.preferred').first()).toHaveCSS('font-size', '22px');
    await expect(page.locator('.message-translation').first()).toHaveCSS('font-size', '22px');
  }
  await b.reload();
  await expect(b.getByText('Bạn khỏe không?', { exact: true })).toBeVisible();
  await expect(b.locator('[data-message-id]')).toHaveCount(2);
  await first.close(); await second.close();
});

test('microphone denial shows recovery without suggesting text input', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => { throw new DOMException('Permission denied', 'NotAllowedError'); },
    });
  });
  await register(page); await create(page);
  await page.getByRole('button', { name: 'Bắt đầu nghe', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('chưa cho phép dùng micro');
  await expect(page.getByRole('button', { name: 'Bắt đầu nghe', exact: true })).toBeVisible();
  await expect(page.locator('textarea[aria-label^="Tin nhắn người "]')).toHaveCount(0);
  await expect(page.getByText(/nhập chữ|nhập lời/i)).toHaveCount(0);
});

test('disabled speech configuration explains voice input is unavailable', async ({ page }) => {
  await page.route('**/api/config', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ languages: {}, speech: 'disabled', translation_configured: true }),
  }));
  await register(page); await create(page);
  await expect(page.getByRole('button', { name: 'Bắt đầu nghe', exact: true })).toBeDisabled();
  await expect(page.getByText(/nhận giọng nói chưa sẵn sàng/i)).toBeVisible();
  await expect(page.locator('textarea[aria-label^="Tin nhắn người "]')).toHaveCount(0);
});

test('microphone capture can start and stop without text input', async ({ page }) => {
  await page.route('**/api/config', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ languages: {}, speech: 'ready', translation_configured: true }) }));
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
        window.__audioSource = { context, oscillator, stream: destination.stream };
        return destination.stream;
      },
    });
  });
  await register(page); await create(page);
  await page.getByRole('button', { name: 'Bắt đầu nghe', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dừng micro', exact: true })).toBeVisible();
  await expect(page.locator('textarea[aria-label^="Tin nhắn người "]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Dừng micro', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bắt đầu nghe', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__audioSource.stream.getTracks().every(track => track.readyState === 'ended'))).toBe(true);
  await page.evaluate(() => window.__audioSource.context.close());
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
  await seedTranscriptMessage(page, 'A', 'Xin chào');
  await expect(page.getByText('Hello', { exact: true })).toHaveCount(1);
  await page.evaluate(() => window.__connections.at(-1).close());
  await expect(page.getByRole('status')).toContainText('Đang kết nối lại');
  await seedTranscriptMessage(page, 'B', 'How are you?');
  await expect(page.getByRole('status')).toHaveText('Đã kết nối');
  await expect(page.getByText('Bạn khỏe không?', { exact: true })).toHaveCount(1);
  await expect(page.locator('[data-message-id]')).toHaveCount(2);
});

test('mobile landscape keeps voice control accessible', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await register(page); await create(page);
  await expect(page.locator('textarea[aria-label^="Tin nhắn người "]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bắt đầu nghe', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('voice room remains scrollable and microphone reachable with enlarged text', async ({ page }) => {
  await register(page);
  await create(page);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await expect(page.locator('textarea[aria-label^="Tin nhắn người "]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bắt đầu nghe', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Bắt đầu nghe', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Bắt đầu nghe', exact: true })).toBeInViewport();
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Về danh sách hội thoại' }).click();
  await expect(page.getByRole('button', { name: 'Tạo cuộc trò chuyện', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Tạo cuộc trò chuyện', exact: true }).click();
  const dialog = page.getByRole('dialog');
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('history persists and owner can delete the conversation', async ({ page }) => {
  await register(page); await create(page);
  await seedTranscriptMessage(page, 'A', 'Xin chào');
  await expect(page.getByText('Hello', { exact: true })).toHaveCount(1);
  await page.getByRole('link', { name: 'Về danh sách hội thoại' }).click();
  await page.getByRole('link', { name: /Cà phê cùng bạn/ }).click();
  await expect(page.getByText('Hello', { exact: true })).toHaveCount(1);
  await page.getByRole('link', { name: 'Về danh sách hội thoại' }).click();
  await page.getByRole('button', { name: 'Xóa Cà phê cùng bạn' }).click();
  await page.getByRole('button', { name: 'Xóa hội thoại', exact: true }).click();
  await expect(page.getByRole('link', { name: /Cà phê cùng bạn/ })).toHaveCount(0);
});
