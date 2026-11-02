import assert from 'node:assert/strict';
import test from 'node:test';
import { settings } from '../src/locales/settings.js';

test('settings translations cover safe gateway failure codes in every locale', () => {
  for (const locale of ['vi', 'en', 'zh-CN']) {
    for (const code of ['not_configured', 'upstream_auth', 'rate_limited', 'timeout', 'unavailable', 'invalid_response']) {
      assert.equal(typeof settings[locale][`settings.test.${code}`], 'string');
      assert.ok(settings[locale][`settings.test.${code}`].length > 0);
    }
  }
});
