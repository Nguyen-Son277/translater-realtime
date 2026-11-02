export const SPEECH_DEFAULTS = Object.freeze({ silence_ms: 1400, max_segment_ms: 8000, preview_ms: 1000 });
export const SPEECH_FIELDS = Object.freeze([
  { key: 'silence_ms', min: 200, max: 2000 },
  { key: 'max_segment_ms', min: 1000, max: 10000 },
  { key: 'preview_ms', min: 400, max: 5000 },
]);

// Keep drafts as strings: Number('') and parseInt would silently accept invalid input.
export function validateSpeechSettings(draft) {
  const values = {};
  const errors = {};
  for (const { key, min, max } of SPEECH_FIELDS) {
    const raw = draft[key];
    const value = Number(raw);
    if (!/^\d+$/.test(String(raw)) || !Number.isSafeInteger(value) || value % 20 !== 0) errors[key] = 'integer';
    else if (value < min || value > max) errors[key] = 'range';
    else values[key] = value;
  }
  for (const key of ['silence_ms', 'preview_ms']) {
    if (!errors[key] && !errors.max_segment_ms && values[key] >= values.max_segment_ms) errors[key] = 'lessThanMax';
  }
  return { values, errors };
}
