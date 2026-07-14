// Oakstones 1 Bank — one hook to make any page display money in the user's currency.
// Usage inside a component:
//   const { fmt, toUsd, currency } = useMoney();
//   fmt(1234.5)        -> "€1,135.74" for an EUR user, "$1,234.50" for USD
//   toUsd('1000')      -> converts an amount the user typed (their currency) into USD for the API
// The USD ledger is never affected — this is display/input translation only.

import { useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../services/api';
import { fmt as moneyFmt, toUsd as moneyToUsd, loadRates, symbolFor } from './money';

export function useMoney() {
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.getMe().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => { loadRates(); }, []);

  const currency: string = me?.currency ?? 'USD';

  const fmt = useCallback(
    (n: number | string | null | undefined) => moneyFmt(n as any, currency),
    [currency]
  );

  const toUsd = useCallback(
    (n: number | string) => moneyToUsd(n, currency),
    [currency]
  );

  return { fmt, toUsd, currency, symbol: symbolFor(currency) };
}
