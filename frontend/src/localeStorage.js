export const LOCALE_STORAGE_KEY = 'transqora.uiLocale';
// Legacy key is read only as a fallback to preserve the user's saved preference.
export const LEGACY_LOCALE_STORAGE_KEY = 'songngu.uiLocale';

export function readLocale(storage, validCodes, fallback = 'vi') {
  try {
    const current = storage.getItem(LOCALE_STORAGE_KEY);
    if (validCodes.has(current)) return current;
    const legacy = storage.getItem(LEGACY_LOCALE_STORAGE_KEY);
    if (validCodes.has(legacy)) {
      // Failure to persist must not discard a successfully read preference.
      try { storage.setItem(LOCALE_STORAGE_KEY, legacy); } catch {}
      return legacy;
    }
  } catch {}
  return fallback;
}

export function persistLocale(storage, code) {
  try { storage.setItem(LOCALE_STORAGE_KEY, code); } catch {}
}
