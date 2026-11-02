import test from 'node:test';
import assert from 'node:assert/strict';
import { translations, errorMessages, SUPPORTED_LOCALES } from '../src/locales/index.js';

test('i18n dictionaries: all supported locales have identical keys', () => {
  const viKeys = Object.keys(translations.vi).sort();
  const enKeys = Object.keys(translations.en).sort();
  const zhKeys = Object.keys(translations['zh-CN']).sort();

  assert.deepEqual(enKeys, viKeys, 'English dictionary must have exact same keys as Vietnamese');
  assert.deepEqual(zhKeys, viKeys, 'Chinese dictionary must have exact same keys as Vietnamese');
  assert.ok(viKeys.length >= 170, `Expected at least 170 keys, found ${viKeys.length}`);
});

test('i18n dictionaries: interpolation placeholders match across locales', () => {
  const placeholderRegex = /\{(\w+)\}/g;
  for (const key of Object.keys(translations.vi)) {
    const viMatches = [...translations.vi[key].matchAll(placeholderRegex)].map(m => m[1]).sort();
    const enMatches = [...translations.en[key].matchAll(placeholderRegex)].map(m => m[1]).sort();
    const zhMatches = [...translations['zh-CN'][key].matchAll(placeholderRegex)].map(m => m[1]).sort();

    assert.deepEqual(enMatches, viMatches, `Key "${key}" has mismatched placeholders in English`);
    assert.deepEqual(zhMatches, viMatches, `Key "${key}" has mismatched placeholders in Chinese`);
  }
});

test('i18n supported locales: supported codes and language metadata are correct', () => {
  assert.deepEqual(SUPPORTED_LOCALES.map(l => l.code), ['vi', 'en', 'zh-CN']);
  const vi = SUPPORTED_LOCALES.find(l => l.code === 'vi');
  const en = SUPPORTED_LOCALES.find(l => l.code === 'en');
  const zh = SUPPORTED_LOCALES.find(l => l.code === 'zh-CN');

  assert.equal(vi.label, 'Tiếng Việt');
  assert.equal(vi.htmlLang, 'vi');
  assert.equal(vi.formatLocale, 'vi-VN');

  assert.equal(en.label, 'English');
  assert.equal(en.htmlLang, 'en');
  assert.equal(en.formatLocale, 'en-US');

  assert.equal(zh.label, '简体中文');
  assert.equal(zh.htmlLang, 'zh-Hans');
  assert.equal(zh.formatLocale, 'zh-CN');
});

test('error localization: every UI notice has en and zh-CN translations', async () => {
  const { readFileSync } = await import('node:fs');
  for (const file of ['src/useMicrophone.js', 'src/useRoom.js']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const literals = [...source.matchAll(/(?:setNotice|finish|new Error)\(\s*'([^']{15,})'/g)].map(match => match[1]);
    assert.ok(literals.length > 0, `${file} should contain user-facing notices`);
    for (const message of literals) {
      const entry = errorMessages[message];
      assert.ok(entry, `missing translation entry for: ${message.slice(0, 60)}`);
      assert.ok(entry.en, `missing en translation for: ${message.slice(0, 60)}`);
      assert.ok(entry['zh-CN'], `missing zh-CN translation for: ${message.slice(0, 60)}`);
    }
  }
});

test('error localization: known error messages are translated', () => {
  const networkError = 'Không kết nối được máy chủ. Nội dung của bạn vẫn được giữ lại.';
  assert.equal(errorMessages[networkError].en, 'Unable to connect to server. Your content has been preserved.');
  assert.equal(errorMessages[networkError]['zh-CN'], '无法连接到服务器。您的内容已被保留。');

  const rateLimit = 'rate_limited';
  assert.equal(errorMessages[rateLimit].vi, 'Dịch vụ đang bận, hãy thử lại sau.');
  assert.equal(errorMessages[rateLimit].en, 'Service is busy, please try again later.');
  assert.equal(errorMessages[rateLimit]['zh-CN'], '服务繁忙，请稍后重试。');

  const micHttps = 'Micro cần kết nối HTTPS trên điện thoại, hoặc localhost trên máy tính.';
  assert.equal(errorMessages[micHttps].en, 'Microphone requires HTTPS on mobile, or localhost on computer.');
  assert.equal(errorMessages[micHttps]['zh-CN'], '在手机上使用麦克风需要 HTTPS 连接，或在电脑上使用 localhost。');
});
