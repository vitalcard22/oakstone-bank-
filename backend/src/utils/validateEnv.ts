/**
 * Validates required environment variables at startup.
 * Throws a clear error if any are missing.
 */
export function validateEnv(): void {
  const required = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join('\n')}\n\nCopy .env.example to .env and fill in all values.`
    );
  }

  if ((process.env.JWT_SECRET ?? '').length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }

  if ((process.env.JWT_REFRESH_SECRET ?? '').length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long.');
  }
}
