import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { txApi } from '../../services/api';
import { useMoney } from '../../utils/useMoney';

const TYPE_LABEL: Record<string, string> = {
  transfer: 'Internal transfer', zelle: 'Zelle', ach: 'ACH transfer', wire: 'Wire transfer',
  fee: 'Fee', deposit: 'Deposit', withdrawal: 'Withdrawal', payment: 'Payment',
};



const statusClass = (s: string) =>
  s === 'completed' ? 'bg-green-50 text-green-700'
  : s === 'pending' ? 'bg-amber-50 text-amber-700'
  : s === 'failed'  ? 'bg-red-50 text-red-700'
  : 'bg-gray-100 text-gray-600';

// Date group header label: Today / Yesterday / full date
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Today';
  if (same(d, y)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
}
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export default function TransactionsPage() {
  const { fmt: money } = useMoney();
  const [accountId, setAccountId] = useState('');
  const [type, setType] = useState('');
  const [days, setDays] = useState('0');

  const { data, isLoading } = useQuery({
    queryKey: ['tx-history', accountId, type, days],
    queryFn: () => txApi.history({ accountId: accountId || undefined, type: type || undefined, days: days !== '0' ? days : undefined }).then(r => r.data),
  });

  const accounts = data?.accounts ?? [];
  const txs = data?.transactions ?? [];
  const showBalance = !!accountId;

  // group transactions by calendar day (already sorted newest-first by the API)
  const groups: { label: string; items: any[] }[] = [];
  for (const t of txs) {
    const label = dayLabel(t.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(t);
    else groups.push({ label, items: [t] });
  }

  const selectCls = "text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Transaction history</h1>
      <p className="text-sm text-gray-400 mb-5">All activity across your accounts.</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <select value={accountId} onChange={e => setAccountId(e.target.value)} className={selectCls}>
          <option value="">All accounts</option>
          {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <select value={type} onChange={e => setType(e.target.value)} className={selectCls}>
          <option value="">All types</option>
          <option value="transfer">Internal transfer</option>
          <option value="zelle">Zelle</option>
          <option value="ach">ACH</option>
          <option value="wire">Wire</option>
          <option value="deposit">Deposit</option>
          <option value="withdrawal">Withdrawal</option>
          <option value="fee">Fee</option>
        </select>
        <select value={days} onChange={e => setDays(e.target.value)} className={selectCls}>
          <option value="0">All time</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-gray-400 text-center py-10">Loading transactions…</p>}
      {!isLoading && txs.length === 0 && (
        <div className="card"><p className="text-sm text-gray-400 text-center py-10">No transactions match these filters.</p></div>
      )}

      <div className="space-y-5">
        {groups.map(group => (
          <div key={group.label}>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 px-1">{group.label}</p>
            <div className="card divide-y divide-gray-100">
              {group.items.map((t: any) => {
                const cpAcct = t.counterparty_account ? `••••${String(t.counterparty_account).slice(-4)}` : null;
                const cp = [t.counterparty_name, cpAcct].filter(Boolean).join(' ');
                return (
                  <Link key={t.id} to={`/transfer/receipt/${t.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {TYPE_LABEL[t.tx_type] ?? t.tx_type}
                        {cp && <span className="text-gray-400 font-normal"> · {cp}</span>}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {timeLabel(t.created_at)} · {t.reference_id}
                        {t.description ? ` · ${t.description}` : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-semibold font-mono ${t.outgoing ? 'text-gray-900' : 'text-green-600'}`}>
                        {t.outgoing ? '-' : '+'}{money(t.amount)}
                      </p>
                      {showBalance && t.balance_after != null ? (
                        <p className="text-[11px] text-gray-400 font-mono">Bal {money(t.balance_after)}</p>
                      ) : (
                        <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${statusClass(t.status)}`}>
                          {String(t.status).charAt(0).toUpperCase() + String(t.status).slice(1)}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
