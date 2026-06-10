import { Pool } from 'pg';

let pool: Pool;

export async function initDb(): Promise<void> {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  await pool.query('SELECT 1');
  console.log('[DB] Connected');
}

export function getDb(): Pool {
  return pool;
}
