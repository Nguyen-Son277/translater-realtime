import { expect, test } from '@playwright/test';

async function prepare(page) {
  await page.addInitScript(() => {
    const NativeSocket = window.WebSocket;
    window.__roomSockets = [];
    window.WebSocket = class extends NativeSocket {
      constructor(...args) {
        super(...args);
        window.__roomSockets.push(this);
      }
    };
  });
  const username = `live_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const registration = await page.request.post('/api/auth/register', {
    data: { username, password: 'test-password-123' },
  });
  expect(registration.status()).toBe(201);
  const response = await page.request.post('/api/rooms', {
    data: { title: 'Việt–Trung', language_a: 'vi', language_b: 'zh', mode: 'shared' },
  });
  return response.json();
}

async function submit(page, room, text, id) {
  const response = await page.request.post(`/api/rooms/${room.id}/messages`, {
    data: { text, speaker: 'A', client_message_id: id },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

async function emit(page, payload) {
  await page.evaluate(value => {
    window.__roomSockets.at(-1).dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) }));
  }, payload);
}

test('newest messages and live speech lead both panels without breaking history or reconnect', async ({ page }) => {
  const room = await prepare(page);
  for (let index = 0; index < 55; index++) {
    await submit(page, room, `Câu tiếng Việt số ${index}`, `history-${String(index).padStart(3, '0')}`);
  }
  await page.goto(`/rooms/${room.id}`);
  await expect(page.getByRole('status')).toHaveText('Đã kết nối');
  const a = page.getByRole('log', { name: 'Hội thoại người A' });
  const b = page.getByRole('log', { name: 'Hội thoại người B' });
  await expect(a.locator('[data-message-id]')).toHaveCount(50);
  await expect(a.locator('.message-text').first()).toHaveText('Câu tiếng Việt số 54');
  await expect(a.locator('.message-text').last()).toHaveText('Câu tiếng Việt số 5');
  await a.getByRole('button', { name: 'Xem hội thoại trước' }).scrollIntoViewIfNeeded();
  const position = await a.evaluate(element => element.scrollTop);
  await b.evaluate(element => { element.scrollTop = 300; });
  await a.getByRole('button', { name: 'Xem hội thoại trước' }).click();
  await expect(a.locator('[data-message-id]')).toHaveCount(55);
  await expect(a.locator('.message-text').last()).toHaveText('Câu tiếng Việt số 0');
  expect(Math.abs(await a.evaluate(element => element.scrollTop) - position)).toBeLessThan(2);
  expect(await b.evaluate(element => element.scrollTop)).toBe(300);

  const partial = { type: 'transcript.partial', segment_id: 'current-voice', text: 'Tôi đang nói tiếng Việt', speaker: 'A', user_id: room.owner_id };
  await emit(page, partial);
  for (const feed of [a, b]) {
    await expect.poll(() => feed.evaluate(element => element.scrollTop)).toBe(0);
    await expect(feed.locator('.partial-message').first()).toContainText('Tôi đang nói tiếng Việt');
    expect(await feed.evaluate(element => element.firstElementChild.classList.contains('partial-message'))).toBe(true);
    await feed.evaluate(element => { element.scrollTop = 350; });
  }
  await emit(page, { ...partial, text: 'Tôi đang nói tiếng Việt, câu tiếp theo' });
  await expect.poll(() => a.evaluate(element => element.scrollTop)).toBe(0);
  await expect.poll(() => b.evaluate(element => element.scrollTop)).toBe(0);
  await emit(page, { ...partial, text: '' });
  for (const feed of [a, b]) await feed.evaluate(element => { element.scrollTop = 350; });
  const newest = await submit(page, room, 'Lời nói mới nhất', 'newest-message');
  for (const feed of [a, b]) {
    await expect(feed.locator('[data-message-id]').first()).toHaveAttribute('data-message-id', newest.id);
    await expect.poll(() => feed.evaluate(element => element.scrollTop)).toBe(0);
  }
  const old = await a.locator('[data-message-id]').last().getAttribute('data-message-id');
  const history = await page.request.get(`/api/rooms/${room.id}/messages?limit=100`);
  const oldMessage = (await history.json()).messages.find(message => message.id === old);
  await a.evaluate(element => { element.scrollTop = 400; });
  await emit(page, { type: 'message.upsert', message: { ...oldMessage, version: oldMessage.version + 2, translation: '更新后的翻译', status: 'translated' } });
  await expect(a.locator(`[data-message-id="${old}"]`)).toContainText('更新后的翻译');
  expect(await a.evaluate(element => element.scrollTop)).toBe(400);
  await expect(a.locator('[data-message-id]').first()).toHaveAttribute('data-message-id', newest.id);

  await page.evaluate(() => window.__roomSockets.at(-1).close());
  await expect(page.getByRole('status')).toContainText('Đang kết nối lại');
  const reconnected = await submit(page, room, 'Câu khi kết nối lại', 'reconnect-newest');
  await expect(page.getByRole('status')).toHaveText('Đã kết nối');
  await expect(a.locator('[data-message-id]')).toHaveCount(57);
  await expect(a.locator('[data-message-id]').first()).toHaveAttribute('data-message-id', reconnected.id);
  await expect.poll(() => a.evaluate(element => element.scrollTop)).toBe(0);
});

test('incoming speech wins when an older-history request is pending', async ({ page }) => {
  const room = await prepare(page);
  for (let index = 0; index < 52; index++) {
    await submit(page, room, `Lịch sử ${index}`, `race-history-${index}`);
  }
  await page.goto(`/rooms/${room.id}`);
  const feed = page.getByRole('log', { name: 'Hội thoại người A' });
  await expect(feed.locator('[data-message-id]')).toHaveCount(50);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let requested;
  const started = new Promise(resolve => { requested = resolve; });
  await page.route('**/api/rooms/*/messages?before=*', async route => {
    const response = await route.fetch();
    requested();
    await pending;
    await route.fulfill({ response });
  });
  await feed.getByRole('button', { name: 'Xem hội thoại trước' }).click();
  await started;
  const newest = await submit(page, room, 'Câu mới trong lúc tải lịch sử', 'history-race-new');
  await expect(feed.locator('[data-message-id]').first()).toHaveAttribute('data-message-id', newest.id);
  release();
  await expect(feed.locator('[data-message-id]')).toHaveCount(53);
  await expect.poll(() => feed.evaluate(element => element.scrollTop)).toBe(0);
});
