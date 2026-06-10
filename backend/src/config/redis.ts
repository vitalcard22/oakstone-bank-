import { createClient } from 'redis';

let client: ReturnType<typeof createClient> | null = null;

export async function initRedis(): Promise<void> {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  if (process.env.NODE_ENV === 'production' && url === 'redis://localhost:6379') {
    console.log('[Redis] Skipping — no Redis configured');
    return;
  }
  try {
    client = createClient({ url, socket: { connectTimeout: 5000 } });
    client.on('error', (e) => console.error('[Redis]', e.message));
    await client.connect();
    console.log('[Redis] Connected');
  } catch (e) {
    console.warn('[Redis] Could not connect — running without cache');
    client = null;
  }
}

export function getRedis() { return client; }

export const keys = {
  session:   (uid: string) => `session:${uid}`,
  blacklist: (jti: string) => `bl:${jti}`,
  otp:       (uid: string) => `otp:${uid}`,
  fraud:     (uid: string) => `fraud:rapid:${uid}`,
  lastIp:    (uid: string) => `fraud:ip:${uid}`,
};

export const safeRedis = {
  async get(key: string): Promise<string | null> {
    try { return client ? await client.get(key) : null; } catch { return null; }
  },
  async setEx(key: string, ttl: number, value: string): Promise<void> {
    try { if (client) await client.setEx(key, ttl, value); } catch {}
  },
  async del(key: string): Promise<void> {
    try { if (client) await client.del(key); } catch {}
  },
  async incr(key: string): Promise<number> {
    try { return client ? await client.incr(key) : 1; } catch { return 1; }
  },
  async expire(key: string, ttl: number): Promise<void> {
    try { if (client) await client.expire(key, ttl); } catch {}
  },
};