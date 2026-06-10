import { Pool } from 'pg';

let pool: Pool;

export async function initDb(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  pool = new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 10000,
    ssl: connectionString.includes('sslmode=disable')
      ? false
      : { rejectUnauthorized: false },
  });

  let retries = 5;
  while (retries > 0) {
    try {
      await pool.query('SELECT 1');
      console.log('[DB] Connected');
      return;
    } catch (e: any) {
      retries--;
      console.log(`[DB] Retrying... ${retries} left`);
      if (retries === 0) throw e;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

export function getDb(): Pool { return pool; }