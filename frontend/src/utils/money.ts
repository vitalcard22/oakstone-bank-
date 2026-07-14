// Oakstones 1 Bank — display-layer currency conversion.
// The ledger is ALWAYS USD. These helpers only translate what the user SEES.
//   fmt(usdAmount, currency)  -> "¥14,900" for a JPY user
//   toUsd(localAmount, currency) -> converts what a user typed back into USD before sending to the API
// Rates come from GET /api/v1/rates (live, Redis-cached daily on the backend).
// If that fetch fails, FALLBACK_RATES keeps every page working.

import { api } from "../services/api";

const FALLBACK_RATES: Record<string, number> = {
  USD: 1, CAD: 1.37, GBP: 0.79, EUR: 0.92, BRL: 5.4, MXN: 18.2, CNY: 7.25, JPY: 149,
  AUD: 1.51, NZD: 1.66, CHF: 0.88, SEK: 10.5, NOK: 10.7, DKK: 6.86, PLN: 3.95, CZK: 23.2,
  HUF: 356, RON: 4.58, NGN: 1496, GHS: 15.6, KES: 129, ZAR: 18.1, EGP: 48.5, MAD: 9.9,
  INR: 83.5, PKR: 278, BDT: 118, IDR: 16200, MYR: 4.45, SGD: 1.34, THB: 34.5, VND: 25400,
  PHP: 58.5, KRW: 1380, HKD: 7.81, TWD: 32.5, AED: 3.67, SAR: 3.75, QAR: 3.64, KWD: 0.31,
  ILS: 3.72, TRY: 34.5, ARS: 1050, CLP: 950, COP: 4150, PEN: 3.75, RUB: 92, UAH: 41.5,
};

let RATES: Record<string, number> = { ...FALLBACK_RATES };
let loaded = false;
let loadingPromise: Promise<void> | null = null;

/** Load live rates once per session. Safe to call many times; only fetches once. */
export function loadRates(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loadingPromise) return loadingPromise;
  loadingPromise = api
    .get("/rates")
    .then((res: any) => {
      const rates = res?.data?.rates;
      if (rates && typeof rates === "object" && rates.USD === 1) {
        RATES = { ...FALLBACK_RATES, ...rates };
      }
      loaded = true;
    })
    .catch(() => {
      // Keep fallback rates; retry allowed on next call.
      loadingPromise = null;
    });
  return loadingPromise;
}

export function getRate(currency?: string): number {
  if (!currency) return 1;
  return RATES[currency.toUpperCase()] ?? 1;
}

// Currencies that conventionally show no decimal places.
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "UGX", "RWF", "GNF", "PYG", "XOF", "XAF", "KMF", "DJF", "BIF", "VUV", "MGA"]);

/**
 * Format a USD ledger amount in the user's display currency.
 * fmt(100, 'JPY') -> "¥14,900"   fmt(100) -> "$100.00"
 */
export function fmt(usdAmount: number | string | null | undefined, currency: string = "USD"): string {
  const n = typeof usdAmount === "string" ? parseFloat(usdAmount) : usdAmount ?? 0;
  const safe = Number.isFinite(n as number) ? (n as number) : 0;
  const cur = (currency || "USD").toUpperCase();
  const converted = safe * getRate(cur);
  const digits = ZERO_DECIMAL.has(cur) ? 0 : 2;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(converted);
  } catch {
    // Unknown currency code fallback
    return `${cur} ${converted.toFixed(digits)}`;
  }
}

/**
 * Convert an amount the user typed (in their currency) back into USD for the API.
 * toUsd(14900, 'JPY') -> 100.00
 */
export function toUsd(localAmount: number | string, currency: string = "USD"): number {
  const n = typeof localAmount === "string" ? parseFloat(localAmount) : localAmount;
  if (!Number.isFinite(n)) return 0;
  const rate = getRate(currency);
  if (!rate) return n;
  return Math.round((n / rate) * 100) / 100;
}

/** Currency symbol only, e.g. symbolFor('JPY') -> "¥" */
export function symbolFor(currency: string = "USD"): string {
  try {
    const parts = new Intl.NumberFormat("en-US", { style: "currency", currency }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}
