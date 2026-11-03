import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { currentVersion, releases } from '../src/releases.js';
import { SUPPORTED_LOCALES } from '../src/locales/index.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
test('release history matches package and has unique complete localized releases', () => {
  assert.equal(currentVersion, pkg.version);
  assert.equal(releases[0].version, currentVersion);
  assert.equal(new Set(releases.map(item => item.version)).size, releases.length);
  for (const release of releases) {
    assert.match(release.version, /^\d+\.\d+\.\d+$/);
    for (const { code } of SUPPORTED_LOCALES) {
      assert.ok(release.title[code]);
      assert.ok(release.features[code].length);
      assert.ok(release.features[code].every(item => typeof item === 'string' && item.length));
    }
  }
});
