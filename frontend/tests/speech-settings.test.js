import assert from 'node:assert/strict';
import test from 'node:test';
import { SPEECH_DEFAULTS, SPEECH_FIELDS, validateSpeechSettings } from '../src/speechSettings.js';
import { settings } from '../src/locales/settings.js';

const draft = values => ({ ...SPEECH_DEFAULTS, ...values });

test('speech defaults and integer strings validate without changing input', () => {
  assert.deepEqual(SPEECH_DEFAULTS, { silence_ms: 1400, max_segment_ms: 8000, preview_ms: 1000 });
  const input = { silence_ms: '1400', max_segment_ms: '8000', preview_ms: '1000' };
  assert.deepEqual(validateSpeechSettings(input), { values: SPEECH_DEFAULTS, errors: {} });
  assert.equal(input.silence_ms, '1400');
});

test('speech validation rejects empty, non-integer, exponent, and non-step input', () => {
  for (const value of ['', ' ', '1400.0', '1400.5', '1.4e3', '1400ms', ' 1400', '1400 ', 'NaN', Infinity, null, undefined, true, 1401, -20]) {
    for (const { key } of SPEECH_FIELDS) {
      assert.equal(validateSpeechSettings(draft({ [key]: value })).errors[key], 'integer', `${key}: ${String(value)}`);
    }
  }
});

test('speech validation enforces inclusive ranges and exclusive cross-field limits', () => {
  for (const { key, min, max } of SPEECH_FIELDS) {
    const base = { silence_ms: 200, max_segment_ms: 10000, preview_ms: 400 };
    for (const value of [min, max]) assert.deepEqual(validateSpeechSettings({ ...base, [key]: value }).errors, {});
    for (const value of [min - 20, max + 20]) assert.equal(validateSpeechSettings({ ...base, [key]: value }).errors[key], 'range');
  }
  for (const key of ['silence_ms', 'preview_ms']) {
    for (const value of [1000, 1020]) assert.equal(validateSpeechSettings(draft({ max_segment_ms: 1000, [key]: value })).errors[key], 'lessThanMax');
  }
  assert.deepEqual(validateSpeechSettings({ silence_ms: 980, max_segment_ms: 1000, preview_ms: 980 }).errors, {});
});

test('speech locale keys and interpolation parameters match in all three locales', () => {
  const keys = Object.keys(settings.vi).filter(key => key.startsWith('speech.')).sort();
  assert.ok(keys.length >= 20);
  for (const locale of ['en', 'zh-CN']) {
    assert.deepEqual(Object.keys(settings[locale]).filter(key => key.startsWith('speech.')).sort(), keys);
    for (const key of keys) {
      assert.ok(settings[locale][key].length > 0);
      assert.deepEqual(settings[locale][key].match(/\{\w+\}/g), settings.vi[key].match(/\{\w+\}/g));
    }
  }
  assert.equal(settings.vi['speech.save'], 'Lưu cấu hình giọng nói');
  assert.equal(settings.vi['speech.recommend'], 'Dùng giá trị đề xuất');
});
