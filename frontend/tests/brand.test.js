import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const bytes = path => readFileSync(new URL(`../public/${path}`, import.meta.url));
function pngSize(path) {
  const data = bytes(path);
  assert.equal(data.subarray(1, 4).toString(), 'PNG');
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}
test('brand exports have expected sizes and ICO includes small favicon variants', () => {
  assert.deepEqual(pngSize('brand/logo.png'), [1360, 256]);
  assert.deepEqual(pngSize('brand/icon-192.png'), [192, 192]);
  assert.deepEqual(pngSize('brand/icon-512.png'), [512, 512]);
  assert.deepEqual(pngSize('apple-touch-icon.png'), [180, 180]);
  const ico = bytes('favicon.ico');
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  assert.deepEqual([ico[6], ico[22], ico[38]], [16, 32, 48]);
});
test('logos are self-contained vector paths, not external images or fonts', () => {
  for (const name of ['brand/logo.svg', 'brand/symbol.svg', 'brand/logo-mono-dark.svg', 'brand/logo-mono-light.svg', 'favicon.svg']) {
    const svg = bytes(name).toString();
    assert.match(svg, /<svg[^>]+viewBox=/);
    assert.match(svg, /<path/);
    assert.doesNotMatch(svg, /<text|<image|<script|<foreignObject|font-family|href=/);
  }
});
