import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PCM16Resampler } from '../public/audio-resampler.js';

test('48 kHz and 44.1 kHz produce exactly one second of 16 kHz audio', () => {
  for (const rate of [48000, 44100, 16000]) {
    const input = Float32Array.from({ length: rate }, (_, i) => .5 * Math.sin(i * 2 * Math.PI * 200 / rate));
    const output = new PCM16Resampler(rate).push(input);
    assert.equal(output.length, 16000);
    assert.ok(output.some(value => value > 0));
    assert.ok(output.some(value => value < 0));
  }
});

test('audio packet boundaries never change resampled output', () => {
  const input = Float32Array.from({ length: 44100 }, (_, i) => Math.sin(i / 17));
  const expected = new PCM16Resampler(44100).push(input);
  const resampler = new PCM16Resampler(44100);
  const actual = [];
  for (let start = 0; start < input.length; start += 128) actual.push(...resampler.push(input.subarray(start, start + 128)));
  assert.deepEqual(actual, expected);
});

test('PCM conversion clips and preserves polarity', () => {
  assert.deepEqual(new PCM16Resampler(16000).push([2, -2, 0, 1, -1]), [32767, -32768, 0, 32767, -32768]);
});
