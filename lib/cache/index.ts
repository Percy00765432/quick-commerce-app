import type { CacheEntry } from '@/types';

const store = new Map<string, CacheEntry<unknown>>();

const TTL_MS = 5 * 60 * 1000; // 5 minutes

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function cacheSet<T>(key: string, data: T, ttlMs = TTL_MS): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function cacheKey(...parts: string[]): string {
  return parts.join(':').toLowerCase().replace(/\s+/g, '_');
}
