import { test, expect } from '@playwright/test';

async function account(context) {
  const username = `remote_${crypto.randomUUID().slice(0, 12)}`;
  const response = await context.request.post('/api/auth/register', { data: {
    username, name: username, email: `${username}@example.com`, password: 'test-password-123', password_confirmation: 'test-password-123',
  } });
  expect(response.ok()).toBe(true);
  return username;
}
async function pair(browser) {
  const aContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const bContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await account(aContext); await account(bContext);
  const response = await aContext.request.post('/api/rooms', { data: { mode: 'remote', title: 'Từ xa', language_a: 'vi', language_b: 'en' } });
  const room = await response.json();
  const invite = await (await aContext.request.post(`/api/rooms/${room.id}/invite`)).json();
  expect((await bContext.request.post('/api/rooms/join', { data: { token: invite.token } })).ok()).toBe(true);
  return { aContext, bContext, url: `/rooms/${room.id}` };
}
async function prepare(page) {
  await page.addInitScript(() => {
    window.__sockets = [];
    const NativeSocket = WebSocket;
    window.WebSocket = class extends NativeSocket {
      constructor(...args) { super(...args); if (String(args[0]).includes('/ws/rooms/')) window.__sockets.push(this); }
      send(data) {
        if (typeof data === 'string') {
          const event = JSON.parse(data);
          if (event.type === 'audio.start') window.__captureId = event.capture_id;
        }
        return super.send(data);
      }
    };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
      const context = new AudioContext(); await context.resume();
      const destination = context.createMediaStreamDestination();
      window.__sources ||= []; window.__sources.push({ context, stream: destination.stream });
      return destination.stream; // Silence: deterministic control tests, no ASR hallucinations.
    } });
  });
}
async function open(page, url) {
  await prepare(page); await page.goto(url);
  await expect(page.getByRole('status')).toHaveText('Đã kết nối');
}
const start = page => page.getByRole('button', { name: 'Bắt đầu nghe', exact: true });
const stop = page => page.getByRole('button', { name: 'Dừng micro', exact: true });

test('remote peers have independent microphones, presence and same-side tab exclusion', async ({ browser }) => {
  const { aContext, bContext, url } = await pair(browser);
  try {
    const a = await aContext.newPage(), b = await bContext.newPage();
    await open(a, url); await open(b, url);
    await expect(a.getByTestId('peer-presence')).toContainText('Trực tuyến');
    await start(a).click(); await expect(stop(a)).toBeVisible();
    await start(b).click(); await expect(stop(b)).toBeVisible();
    await expect(a.getByTestId('peer-presence')).toContainText('Micro đang bật');
    await expect(b.getByTestId('peer-presence')).toContainText('Micro đang bật');
    const duplicate = await aContext.newPage(); await open(duplicate, url);
    await start(duplicate).click();
    await expect(duplicate.getByRole('alert')).toContainText(/micro|Micro/);
    await expect(start(duplicate)).toBeEnabled();
    await expect(stop(a)).toBeVisible(); await expect(stop(b)).toBeVisible();
    await stop(a).click(); await expect(start(a)).toBeEnabled();
    await expect(b.getByTestId('peer-presence')).toContainText('Trực tuyến');
    await expect(stop(b)).toBeVisible();
    await duplicate.close(); await a.close();
    await expect(b.getByTestId('peer-presence')).toContainText('Ngoại tuyến');
    await stop(b).click(); await expect(start(b)).toBeEnabled();
  } finally { await aContext.close(); await bContext.close(); }
});

test('stale capture acknowledgements and old socket callbacks cannot affect a new session', async ({ browser }) => {
  const { aContext, bContext, url } = await pair(browser);
  try {
    const page = await aContext.newPage(); await open(page, url);
    await start(page).click(); await expect(stop(page)).toBeVisible();
    const oldId = await page.evaluate(() => window.__captureId);
    await stop(page).click(); await expect(start(page)).toBeEnabled();
    await start(page).click(); await expect(stop(page)).toBeVisible();
    expect(await page.evaluate(() => window.__captureId)).not.toBe(oldId);
    await page.evaluate(id => window.__sockets.at(-1).onmessage({ data: JSON.stringify({ type: 'audio.state', recording: false, capture_id: id }) }), oldId);
    await expect(stop(page)).toBeVisible();
    await page.evaluate(() => {
      const ws = window.__sockets.at(-1); window.__oldMessage = ws.onmessage; window.__oldClose = ws.onclose; ws.close();
    });
    await expect(start(page)).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Đã kết nối');
    await expect(start(page)).toBeEnabled(); // Reconnect never restarts capture automatically.
    await start(page).click(); await expect(stop(page)).toBeVisible();
    await page.evaluate(() => {
      window.__oldMessage({ data: JSON.stringify({ type: 'room.deleted' }) });
      window.__oldClose({ code: 4401 });
    });
    await expect(stop(page)).toBeVisible(); await expect(page.getByRole('status')).toHaveText('Đã kết nối');
    await stop(page).click(); await expect(start(page)).toBeEnabled();
  } finally { await aContext.close(); await bContext.close(); }
});

test('a missing heartbeat retires the connection and stops microphone without replay', async ({ browser }) => {
  const { aContext, bContext, url } = await pair(browser);
  try {
    const page = await aContext.newPage();
    await page.clock.install();
    await page.routeWebSocket('**/ws/rooms/**', ws => {
      const server = ws.connectToServer();
      server.onMessage(data => { if (JSON.parse(String(data)).type !== 'ping') ws.send(data); });
    });
    await open(page, url); await start(page).click(); await expect(stop(page)).toBeVisible();
    await page.clock.fastForward(31000);
    await expect(start(page)).toBeVisible();
    expect(await page.evaluate(() => window.__sources.every(source => source.stream.getTracks().every(track => track.readyState === 'ended')))).toBe(true);
    await page.clock.fastForward(1500);
    await expect(page.getByRole('status')).toHaveText('Đã kết nối');
    await expect(start(page)).toBeEnabled();
  } finally { await aContext.close(); await bContext.close(); }
});

test('slow uplink closes the capture lease and allows a manual restart', async ({ browser }) => {
  const { aContext, bContext, url } = await pair(browser);
  try {
    const page = await aContext.newPage(); await open(page, url);
    await start(page).click(); await expect(stop(page)).toBeVisible();
    await page.evaluate(() => Object.defineProperty(window.__sockets.at(-1), 'bufferedAmount', { value: 300000 }));
    await expect(page.getByRole('alert')).toContainText('mạng chậm');
    await expect(start(page)).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Đã kết nối');
    await start(page).click(); await expect(stop(page)).toBeVisible();
    await stop(page).click(); await expect(start(page)).toBeEnabled();
  } finally { await aContext.close(); await bContext.close(); }
});

test('backgrounding stops capture and remote controls remain reachable with enlarged text', async ({ browser }) => {
  const { aContext, bContext, url } = await pair(browser);
  try {
    const page = await aContext.newPage(); await open(page, url);
    await start(page).click(); await expect(stop(page)).toBeVisible();
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(start(page)).toBeEnabled();
    await expect(page.getByRole('alert')).toContainText('chuyển ứng dụng');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      document.documentElement.style.fontSize = '200%';
    });
    await page.setViewportSize({ width: 320, height: 568 });
    await start(page).scrollIntoViewIfNeeded(); await expect(start(page)).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(stop(page)).toHaveCount(0);
  } finally { await aContext.close(); await bContext.close(); }
});

test('late microphone permission cannot revive a cancelled capture', async ({ browser }) => {
  const { aContext, bContext, url } = await pair(browser);
  try {
    const page = await aContext.newPage(); await open(page, url);
    await page.evaluate(() => {
      const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: () => new Promise(resolve => {
        window.__grant = async () => resolve(await capture());
      }) });
    });
    await start(page).click();
    await expect(page.getByRole('button', { name: 'Đang mở micro…', exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => typeof window.__grant)).toBe('function');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(start(page)).toBeEnabled();
    await page.evaluate(() => window.__grant());
    await expect.poll(() => page.evaluate(() => window.__sources?.every(source => source.stream.getTracks().every(track => track.readyState === 'ended')))).toBe(true);
    expect(await page.evaluate(() => window.__captureId)).toBeUndefined();
    await expect(start(page)).toBeEnabled();
  } finally { await aContext.close(); await bContext.close(); }
});

test('superseded room fetch cannot open an orphan socket after reconnect', async ({ browser }) => {
  const { aContext, bContext, url } = await pair(browser);
  try {
    const page = await aContext.newPage(); await prepare(page);
    await page.addInitScript(() => {
      const nativeFetch = window.fetch;
      let held = false;
      window.fetch = async (...args) => {
        const response = await nativeFetch(...args);
        if (!held && /^\/api\/rooms\/[^/]+$/.test(String(args[0]))) {
          held = true;
          const body = await response.text();
          window.__heldSignal = args[1].signal;
          // Deliberately ignore abort, as a response already being parsed may do.
          return new Promise(resolve => { window.__releaseRoomFetch = () => resolve(new Response(body, { status: 200 })); });
        }
        return response;
      };
    });
    await page.goto(url);
    await expect.poll(() => page.evaluate(() => typeof window.__releaseRoomFetch)).toBe('function');
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect.poll(() => page.evaluate(() => window.__heldSignal.aborted)).toBe(true);
    await expect(page.getByRole('status')).toHaveText('Đã kết nối');
    await page.evaluate(async () => {
      window.__releaseRoomFetch();
      // Let the retired fetch's response parsing and continuation finish.
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(await page.evaluate(() => window.__sockets.length)).toBe(1);
    await start(page).click(); await expect(stop(page)).toBeVisible();
    await stop(page).click(); await expect(start(page)).toBeEnabled();
  } finally { await aContext.close(); await bContext.close(); }
});

test('remote invitation survives login reload and warns about non-public URLs', async ({ browser }) => {
  const aContext = await browser.newContext(), bContext = await browser.newContext();
  try {
    await account(aContext); const username = await account(bContext);
    const room = await (await aContext.request.post('/api/rooms', { data: { mode: 'remote', title: 'Mời từ xa', language_a: 'vi', language_b: 'en' } })).json();
    const a = await aContext.newPage(); await a.goto(`/rooms/${room.id}`);
    await a.getByRole('button', { name: 'Mời bạn' }).click();
    await expect(a.getByRole('note')).toContainText('HTTPS công khai');
    const invitation = await a.getByLabel('Liên kết mời').inputValue();
    await bContext.clearCookies();
    const b = await bContext.newPage(); await b.goto(invitation); await b.reload();
    await b.getByLabel('Tên đăng nhập', { exact: true }).fill(username);
    await b.locator('#password').fill('test-password-123');
    await b.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(b.getByLabel('Liên kết hoặc mã mời')).not.toHaveValue('');
    await b.getByRole('button', { name: 'Vào phòng', exact: true }).click();
    await expect(b.getByRole('status')).toHaveText('Đã kết nối');
    await expect(b.getByText('Chỉ dịch bằng chữ, chưa có gọi thoại.', { exact: false })).toBeVisible();
  } finally { await aContext.close(); await bContext.close(); }
});
