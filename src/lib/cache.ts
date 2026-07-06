// Tiny in-memory TTL cache. On Vercel this lives per warm serverless instance,
// which is enough to stop the Analytics screen from calling Instagram on every
// page load / range switch and to stay well under Graph API rate limits.

const store = new Map<string, { at: number; value: unknown }>();

export function cacheGet<T>(key: string, ttlMs: number): T | null {
  const e = store.get(key);
  if (e && Date.now() - e.at < ttlMs) return e.value as T;
  if (e) store.delete(key);
  return null;
}

export function cacheSet(key: string, value: unknown): void {
  store.set(key, { at: Date.now(), value });
  // Bound memory: drop the oldest entries if the map grows large.
  if (store.size > 200) {
    const oldest = [...store.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 50);
    for (const [k] of oldest) store.delete(k);
  }
}
