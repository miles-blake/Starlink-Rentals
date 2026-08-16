/**
 * Minimal in-memory TTL cache. Lives for the lifetime of one serverless
 * function instance — a real cache hit rate needs a shared store (e.g.
 * Vercel KV / Upstash Redis), which isn't provisioned yet. Good enough to
 * dedupe rapid repeat calls (map re-renders, a customer nudging dates back
 * and forth) within a warm instance; a cold start starts empty.
 */
export class TtlCache<V> {
  private store = new Map<string, { value: V; expiresAt: number }>();

  constructor(private ttlMs: number) {}

  async getOrSet(key: string, compute: () => Promise<V>): Promise<V> {
    const hit = this.store.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value;
    }
    const value = await compute();
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    return value;
  }
}
