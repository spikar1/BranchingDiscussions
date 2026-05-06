const STORAGE_KEY = 'brandis-byok-openai-key';

export function getStoredOpenAIApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY)?.trim();
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function setStoredOpenAIApiKey(key: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = key?.trim();
    if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // quota / private mode
  }
}

/** Merge into fetch options; never logs the key. */
export function withByokHeaders(headers?: HeadersInit): HeadersInit {
  const merged = new Headers(headers);
  const key = getStoredOpenAIApiKey();
  if (key) merged.set('x-openai-api-key', key);
  return merged;
}
