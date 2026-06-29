import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { accountApi, txApi } from '../../services/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);

const TYPE_LABEL: Record<string, string> = {
  transfer: 'Internal transfer', zelle: 'Zelle', ach: 'ACH transfer', wire: 'Wire transfer',
  fee: 'Fee', deposit: 'Deposit', withdrawal: 'Withdrawal', payment: 'Payment',
};
const timeLabel = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function DashboardPage() {
  const [events, setEvents] = useState<any[]>([]);

  useWebSocket({
    transaction: useCallback((data: any) => {
      setEvents((p) => [data, ...p].slice(0, 20));
      if (data.amount) toast.success(`${data.type?.replace(/_/g,' ')} — ${fmt(data.amount)}`);
    }, []),
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn:  () => accountApi.list().then((r) => r.data),
  });

  const { data: txData } = useQuery({
    queryKey: ['dashboard-recent-tx'],
    queryFn:  () => txApi.history().then((r) => r.data),
  });
  const recent = (txData?.transactions ?? []).slice(0, 6);

  // Real cash flow: last 6 months, income (money in) vs spending (money out).
  // Internal transfers (own → own) are neutral and excluded.
  const now = new Date();
  const buckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, month: d.toLocaleString('en-US', { month: 'short' }), income: 0, spend: 0 };
  });
  const bIdx: Record<string, number> = {};
  buckets.forEach((b, i) => { bIdx[b.key] = i; });
  for (const t of (txData?.transactions ?? [])) {
    if (t.status !== 'completed' || t.tx_type === 'transfer') continue;
    const d = new Date(t.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!(key in bIdx)) continue;
    const amt = parseFloat(t.amount) || 0;
    if (t.outgoing) buckets[bIdx[key]].spend += amt; else buckets[bIdx[key]].income += amt;
  }
  const thisMonth = buckets[buckets.length - 1];
  const net = thisMonth.income - thisMonth.spend;

  const total = accounts?.reduce((s: number, a: any) => s + parseFloat(a.balance), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {label:'System status',    value:'Operational', dot:'bg-green-400'},
          {label:'Security',         value:'Protected',   dot:'bg-green-400'},
          {label:'Fraud protection', value:'Active',      dot:'bg-green-400'},
          {label:'Live events',      value:`${events.length}`, dot:'bg-blue-400'},
        ].map((s) => (
          <div key={s.label} className="card px-4 py-3 flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${s.dot} flex-shrink-0`}/>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</p>
              <p className="text-sm font-medium font-mono text-navy-600">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-navy-600 rounded-xl p-6 text-white">
          <p className="text-xs uppercase tracking-widest text-white/50 mb-1">Total portfolio</p>
          <p className="text-3xl sm:text-4xl font-mono font-bold mb-4 break-words">{fmt(total)}</p>
          <div className="grid grid-cols-2 gap-3">
            {accounts?.map((a: any) => (
              <div key={a.id} className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-white/50 capitalize">{a.account_type} ****{a.account_number?.slice(-4)}</p>
                <p className="text-lg font-mono font-semibold">{fmt(parseFloat(a.balance))}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">Quick actions</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              {label:'Send money', href:'/transfer'},
              {label:'Zelle',      href:'/zelle'},
              {label:'Pay bills',  href:'/transfer'},
              {label:'Freeze card',href:'/cards'},
              {label:'Apply loan', href:'/loans/apply'},
              {label:'Credit card',href:'/cards/apply'},
            ].map((cmd) => (
              <a key={cmd.label} href={cmd.href}
                className="flex items-center justify-center p-2 rounded-md border border-gray-100 hover:bg-gray-50 transition-colors text-center text-xs font-medium text-gray-700">
                {cmd.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Recent transactions</p>
          <Link to="/transactions" className="text-xs font-medium text-emerald-700 hover:underline">View all</Link>
        </div>
        {recent.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No transactions yet</p>}
        <div className="divide-y divide-gray-100">
          {recent.map((t: any) => {
            const cpAcct = t.counterparty_account ? `••••${String(t.counterparty_account).slice(-4)}` : null;
            const cp = [t.counterparty_name, cpAcct].filter(Boolean).join(' ');
            return (
              <Link key={t.id} to={`/transfer/receipt/${t.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {TYPE_LABEL[t.tx_type] ?? t.tx_type}
                    {cp && <span className="text-gray-400 font-normal"> · {cp}</span>}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{timeLabel(t.created_at)} · {t.reference_id}</p>
                </div>
                <p className={`text-sm font-semibold font-mono flex-shrink-0 ${t.outgoing ? 'text-gray-900' : 'text-green-600'}`}>
                  {t.outgoing ? '-' : '+'}{fmt(parseFloat(t.amount))}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Cash flow</h2>
        <p className="text-sm text-gray-400 mb-5">Income vs spending — last 6 months</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={buckets}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
            <XAxis dataKey="month" tick={{fontSize:11,fill:'#9ca3af'}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:11,fill:'#9ca3af',fontFamily:'JetBrains Mono'}} axisLine={false} tickLine={false} tickFormatter={(v)=>`$${(v/1000).toFixed(0)}k`}/>
            <Tooltip formatter={(v: any)=>[fmt(v),'']} contentStyle={{borderRadius:'6px',border:'1px solid #e5e7eb',fontSize:12}}/>
            <Area type="monotone" dataKey="income" stroke="#0D1F3C" strokeWidth={2} fill="#0D1F3C" fillOpacity={0.06} name="Income"/>
            <Area type="monotone" dataKey="spend"  stroke="#C4922A" strokeWidth={2} fill="#C4922A" fillOpacity={0.06} name="Spending"/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Live activity</p>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {events.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Waiting for activity...</p>}
            {events.map((ev, i) => (
              <div key={i} className="flex justify-between items-center text-sm py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-gray-600 capitalize">{ev.type?.replace(/_/g,' ')}</span>
                {ev.amount && <span className="font-mono text-navy-600">{fmt(ev.amount)}</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">This month ({thisMonth.month})</p>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Money in</span>
              <span className="font-mono font-semibold text-green-600">+{fmt(thisMonth.income)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Money out</span>
              <span className="font-mono font-semibold text-gray-900">-{fmt(thisMonth.spend)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-gray-100">
              <span className="text-sm font-medium text-gray-700">Net</span>
              <span className={`font-mono font-semibold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{net >= 0 ? '+' : '-'}{fmt(Math.abs(net))}</span>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-4">Excludes transfers between your own accounts.</p>
        </div>
      </div>
    </div>
  );
}