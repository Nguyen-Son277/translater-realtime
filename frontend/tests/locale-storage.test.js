import test from 'node:test';
import assert from 'node:assert/strict';
import { readLocale, persistLocale, LOCALE_STORAGE_KEY, LEGACY_LOCALE_STORAGE_KEY } from '../src/localeStorage.js';
const codes = new Set(['vi', 'en', 'zh-CN']);
function storage(values = {}) {
  return { getItem: key => values[key] ?? null, setItem: (key, value) => { values[key] = value; }, values };
}
test('new locale wins, legacy preference migrates and invalid preferences fall back', () => {
  const saved = storage({ [LEGACY_LOCALE_STORAGE_KEY]: 'en' });
  assert.equal(readLocale(saved, codes), 'en');
  assert.equal(saved.values[LOCALE_STORAGE_KEY], 'en');
  saved.values[LOCALE_STORAGE_KEY] = 'zh-CN';
  assert.equal(readLocale(saved, codes), 'zh-CN');
  assert.equal(readLocale(storage({ [LOCALE_STORAGE_KEY]: 'bad', [LEGACY_LOCALE_STORAGE_KEY]: 'en' }), codes), 'en');
  assert.equal(readLocale(storage({ [LOCALE_STORAGE_KEY]: 'bad', [LEGACY_LOCALE_STORAGE_KEY]: 'bad' }), codes), 'vi');
  assert.equal(readLocale(storage(), codes), 'vi');
});
test('blocked storage never breaks startup or discards a read legacy preference', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(readLocale(blocked, codes), 'vi');
  assert.doesNotThrow(() => persistLocale(blocked, 'en'));
  assert.equal(readLocale({ getItem: key => key === LEGACY_LOCALE_STORAGE_KEY ? 'en' : null, setItem: blocked.setItem }, codes), 'en');
  const saved = storage();
  persistLocale(saved, 'zh-CN');
  assert.equal(saved.values[LOCALE_STORAGE_KEY], 'zh-CN');
});
