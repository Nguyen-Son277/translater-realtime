import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ApiError, api, mergeMessages, newClientId } from '../src/api.js';

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
});

test('mergeMessages keeps the newest version and sequence order', () => {
  const current = [
    { id: 'older', sequence: 1, version: 2, text: 'old' },
    { id: 'same', sequence: 2, version: 3, text: 'before' },
  ];
  const incoming = [
    { id: 'same', sequence: 2, version: 2, text: 'stale' },
    { id: 'same', sequence: 2, version: 4, text: 'after' },
    { id: 'new', sequence: 3, version: 1, text: 'new' },
  ];

  assert.deepEqual(mergeMessages(current, incoming), [
    { id: 'older', sequence: 1, version: 2, text: 'old' },
    { id: 'same', sequence: 2, version: 4, text: 'after' },
    { id: 'new', sequence: 3, version: 1, text: 'new' },
  ]);
});

test('newClientId returns a non-empty unique identifier', () => {
  const first = newClientId();
  const second = newClientId();
  assert.equal(typeof first, 'string');
  assert.ok(first.length > 0);
  assert.notEqual(first, second);
});

test('api reports network failures as a safe ApiError', async () => {
  globalThis.fetch = async () => { throw new TypeError('network details'); };

  await assert.rejects(
    api('/rooms'),
    error => error instanceof ApiError
      && error.status === 0
      && error.message === 'Không kết nối được máy chủ. Nội dung của bạn vẫn được giữ lại.',
  );
});

test('api dispatches session-expired without exposing response internals', async () => {
  const events = [];
  globalThis.window = { dispatchEvent: event => events.push(event.type) };
  globalThis.fetch = async () => new Response(
    JSON.stringify({ detail: 'Vui lòng đăng nhập để tiếp tục.' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } },
  );

  await assert.rejects(api('/rooms'), error => (
    error instanceof ApiError && error.status === 401
      && error.message === 'Vui lòng đăng nhập để tiếp tục.'
  ));
  assert.deepEqual(events, ['session-expired']);
});

test('api maps translation error codes to safe labels', async () => {
  globalThis.fetch = async () => new Response(
    JSON.stringify({ detail: { code: 'upstream_auth' } }),
    { status: 422, headers: { 'Content-Type': 'application/json' } },
  );

  await assert.rejects(api('/settings/translation/test'), error => (
    error instanceof ApiError
      && error.message === 'API key không hợp lệ hoặc chưa có quyền truy cập model.'
  ));
});
