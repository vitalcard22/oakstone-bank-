import { createClient } from 'redis';

let client: ReturnType<typeof createClient>;

export async function initRedis(): Promise<void> {
  client = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' });
  client.on('error', (e) => console.error('[Redis]', e));
  await client.connect();
  console.log('[Redis] Connected');
}

export function getRedis() {
  return client;
}

export const keys = {
  session:   (uid: string) => `session:${uid}`,
  blacklist: (jti: string) => `bl:${jti}`,
  otp:       (uid: string) => `otp:${uid}`,
  fraud:     (uid: string) => `fraud:rapid:${uid}`,
  lastIp:    (uid: string) => `fraud:ip:${uid}`,
};
