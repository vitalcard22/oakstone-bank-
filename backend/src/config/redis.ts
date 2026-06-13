import { createClient } from 'redis';
type RedisClient = ReturnType<typeof createClient>;
let client: RedisClient | null = null;
export async function initRedis(): Promise<void> {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  if (url === 'redis://localhost:6379') { console.log('[Redis] Skipping'); return; }
  try {
    client = createClient({ url, socket: { connectTimeout: 5000 } });
    client.on('error', (e) => console.error('[Redis]', e.message));
    await client.connect();
    console.log('[Redis] Connected');
  } catch (e: any) { console.warn('[Redis] Failed:', e.message); client = null; }
}
export function getRedis(): RedisClient | null { return client; }
export const keys = { session: (uid: string) => `session:${uid}`, blacklist: (jti: string) => `bl:${jti}`, otp: (uid: string) => `otp:${uid}`, fraud: (uid: string) => `fraud:rapid:${uid}`, lastIp: (uid: string) => `fraud:ip:${uid}` };
export const safeRedis = {
  async get(key: string): Promise<string | null> {
    if (!client) return null;
    try { return await client.get(key); } catch { return null; }
  },
  async setEx(key: string, ttl: number, value: string): Promise<void> {
    if (!client) return;
    try { await client.setEx(key, ttl, value); } catch {}
  },
  async del(key: string): Promise<void> {
    if (!client) return;
    try { await client.del(key); } catch {}
  },
  async incr(key: string): Promise<number> {
    if (!client) return 1;
    try { return await client.incr(key); } catch { return 1; }
  },
  async expire(key: string, ttl: number): Promise<void> {
    if (!client) return;
    try { await client.expire(key, ttl); } catch {}
  },
};