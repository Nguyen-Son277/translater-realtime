import test from 'node:test';
import assert from 'node:assert/strict';
import { invitationWarning } from '../src/remote.js';
import { mergeMessages } from '../src/api.js';

test('invitation warning flags HTTP, loopback, private IP and local hostnames', () => {
  for (const url of ['http://example.com', 'https://localhost', 'https://127.0.0.1', 'https://192.168.1.10', 'https://10.0.0.1', 'https://172.31.1.1', 'https://100.64.1.1', 'https://[::1]', 'https://[fd00::1]', 'https://[fe80::1]', 'https://phone.local', 'https://intranet']) {
    assert.ok(invitationWarning(new URL(url)), url);
  }
  for (const url of ['https://translate.example.com', 'https://172.32.1.1']) assert.equal(invitationWarning(new URL(url)), '');
});

test('resync updates existing translations without removing deliberate identical messages', () => {
  const original = { id: 'a', sequence: 1, version: 1, text: 'Hello', translation: null };
  const translated = { ...original, version: 2, translation: 'Xin chào' };
  const repeated = { ...translated, id: 'b', sequence: 2 };
  const result = mergeMessages([translated, repeated], [original, translated]);
  assert.deepEqual(result, [translated, repeated]);
});
