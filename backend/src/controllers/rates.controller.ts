import { Request, Response, NextFunction } from 'express';
import { safeRedis } from '../config/redis';

// Live exchange rates vs USD.
// Source: open.er-api.com (free, no API key, updated daily).
// Cached in Redis for 24h so the external API is hit at most once per day.
// If both the cache and the live fetch fail, FALLBACK_RATES keeps the app working.

const CACHE_KEY = 'fx:rates:usd';
const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours

// Static fallback (approximate rates) — used only if Redis is empty AND the live fetch fails.
const FALLBACK_RATES: Record<string, number> = {
  USD: 1, CAD: 1.37, GBP: 0.79, EUR: 0.92, BRL: 5.40, MXN: 18.2, CNY: 7.25, JPY: 149,
  AUD: 1.51, NZD: 1.66, CHF: 0.88, SEK: 10.5, NOK: 10.7, DKK: 6.86, PLN: 3.95, CZK: 23.2,
  HUF: 356, RON: 4.58, NGN: 1496, GHS: 15.6, KES: 129, ZAR: 18.1, EGP: 48.5, MAD: 9.9,
  INR: 83.5, PKR: 278, BDT: 118, IDR: 16200, MYR: 4.45, SGD: 1.34, THB: 34.5, VND: 25400,
  PHP: 58.5, KRW: 1380, HKD: 7.81, TWD: 32.5, AED: 3.67, SAR: 3.75, QAR: 3.64, KWD: 0.31,
  ILS: 3.72, TRY: 34.5, ARS: 1050, CLP: 950, COP: 4150, PEN: 3.75, RUB: 92, UAH: 41.5,
};

export async function getRates(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 1) Try Redis cache first
    const cached = await safeRedis.get(CACHE_KEY);
    if (cached) {
      res.json({ base: 'USD', source: 'cache', rates: JSON.parse(cached) });
      return;
    }

    // 2) Cache miss: fetch live rates
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: controller.signal });
      clearTimeout(timeout);
      if (r.ok) {
        const data: any = await r.json();
        if (data && data.result === 'success' && data.rates && data.rates.USD === 1) {
          await safeRedis.setEx(CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(data.rates));
          res.json({ base: 'USD', source: 'live', rates: data.rates });
          return;
        }
      }
    } catch {
      // fall through to fallback
    }

    // 3) Live fetch failed: serve static fallback (do not cache it, so next request retries live)
    res.json({ base: 'USD', source: 'fallback', rates: FALLBACK_RATES });
  } catch (e) {
    next(e);
  }
}
