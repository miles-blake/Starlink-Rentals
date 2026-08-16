/**
 * Minimal in-memory fixed-window rate limiter, keyed by caller (IP). Same
 * caveat as ttl-cache.ts: resets on cold start / doesn't share state across
 * instances. Fine as a first line of defense against casual abuse; swap for
 * a shared store (Vercel KV / Upstash) if this needs to hold under real load.
 */
const windows = new Map<string, { count: number; windowStart: number }>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    windows.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}
