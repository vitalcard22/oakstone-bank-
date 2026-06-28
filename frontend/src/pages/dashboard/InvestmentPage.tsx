import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wealthApi, accountApi } from '../../services/api';
import toast from 'react-hot-toast';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Clock, XCircle, Lock, Info, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

const fmt = (n: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));
const pctf = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;

// Deterministic illustrative price history ending at the live price (clearly labelled)
function history(symbol: string, current: number) {
  let seed = 0; for (const ch of symbol) seed += ch.charCodeAt(0);
  const pts: { t: string; v: number }[] = [];
  let v = current * 0.92;
  for (let i = 0; i < 24; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    const noise = (seed / 233280 - 0.5) * current * 0.02;
    v += (current - v) * 0.12 + noise;
    pts.push({ t: `${i}`, v: Math.max(0.01, +v.toFixed(2)) });
  }
  pts.push({ t: '24', v: current });
  return pts;
}

export default function InvestmentPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState('SPY');
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [shares, setShares] = useState('');
  const [accountId, setAccountId] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['investment'], queryFn: () => wealthApi.investment().then(r => r.data), refetchInterval: 30000 });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => accountApi.list().then(r => r.data) });

  const status = data?.account?.status ?? null;
  const prices = data?.prices ?? {};
  const assets = data?.assets ?? [];
  const holdings = data?.holdings ?? [];
  const refresh = () => { qc.invalidateQueries({ queryKey: ['investment'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); };

  const sel = prices[selected] ?? { price: 0, pct: 0, live: false };
  const chartData = useMemo(() => history(selected, sel.price || 1), [selected, sel.price]);
  const sh = parseFloat(shares) || 0;
  const estCost = sh * (sel.price || 0);
  const ownedShares = holdings.find((h: any) => h.symbol === selected)?.shares ?? 0;

  const portValue = holdings.reduce((s: number, h: any) => s + h.value, 0);
  const portGain = holdings.reduce((s: number, h: any) => s + h.gain, 0);

  const enrollMut = useMutation({ mutationFn: () => wealthApi.enrollInvestment(accountId), onSuccess: () => { refresh(); toast.success('Enrollment requested'); }, onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed') });
  const buyMut = useMutation({ mutationFn: () => wealthApi.buyInvestment(selected, sh), onSuccess: () => { refresh(); setShares(''); toast.success(`Bought ${sh} ${selected}`); }, onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed') });
  const sellMut = useMutation({ mutationFn: () => wealthApi.sellInvestment(selected, sh), onSuccess: () => { refresh(); setShares(''); toast.success('Sell request submitted for approval'); }, onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed') });

  if (isLoading) return <p className="text-sm text-gray-400">Loading market…</p>;

  return (
    <div className="space-y-6">
      {/* Portfolio / hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-teal-700 to-cyan-700 rounded-2xl p-6 sm:p-8 text-white">
        <TrendingUp className="absolute -right-5 -top-5 text-white/10" size={130} />
        <div className="relative">
          <span className="text-emerald-100 text-sm font-medium">Investing</span>
          {status === 'active' ? (
            <>
              <p className="text-emerald-100 text-xs uppercase tracking-wider mt-3 mb-1">Portfolio value</p>
              <h1 className="text-4xl sm:text-5xl font-bold mb-1 break-words">{fmt(portValue)}</h1>
              <p className={`text-sm ${portGain >= 0 ? 'text-emerald-100' : 'text-red-200'}`}>{portGain >= 0 ? '▲' : '▼'} {fmt(Math.abs(portGain))} total return</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl sm:text-4xl font-bold mt-2 mb-2">Build your portfolio</h1>
              <p className="text-emerald-100 text-sm max-w-md">Browse live market prices below. To buy and sell, enroll and an administrator will activate your investment account.</p>
            </>
          )}
        </div>
      </div>

      {/* Chart — visible to everyone */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <div>
            <h3 className="font-semibold text-gray-900">{assets.find((a: any) => a.symbol === selected)?.name} <span className="text-gray-400 text-sm">{selected}</span></h3>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900">{fmt(sel.price)}</span>
              <span className={`text-sm font-medium ${sel.pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{sel.pct >= 0 ? <TrendingUp size={14} className="inline" /> : <TrendingDown size={14} className="inline" />} {pctf(sel.pct || 0)}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${sel.live ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{sel.live ? 'LIVE' : 'last close'}</span>
            </div>
          </div>
        </div>
        <div className="h-44 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity={0.4} /><stop offset="100%" stopColor="#14b8a6" stopOpacity={0} /></linearGradient></defs>
              <XAxis dataKey="t" hide /><YAxis domain={['dataMin', 'dataMax']} hide />
              <Tooltip formatter={(v: any) => fmt(v)} labelFormatter={() => ''} />
              <Area type="monotone" dataKey="v" stroke="#0d9488" strokeWidth={2} fill="url(#g)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-1"><Info size={11} /> Price is live; the chart line is illustrative, not real historical data.</p>
      </div>

      {/* Asset list — visible to everyone */}
      <div className="card divide-y divide-gray-100">
        {assets.map((a: any) => {
          const p = prices[a.symbol] ?? { price: 0, pct: 0 };
          return (
            <button key={a.symbol} onClick={() => setSelected(a.symbol)} className={`w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 ${selected === a.symbol ? 'bg-emerald-50' : ''}`}>
              <div><p className="font-medium text-gray-900 text-sm">{a.name}</p><p className="text-xs text-gray-400">{a.symbol}</p></div>
              <div className="text-right"><p className="font-semibold text-gray-900 text-sm">{fmt(p.price)}</p><p className={`text-xs ${p.pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{pctf(p.pct || 0)}</p></div>
            </button>
          );
        })}
      </div>

      {/* Buy/sell — GATED behind enrollment + approval */}
      {status === 'active' && (
        <div className="card p-6">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-5">
            <button onClick={() => setMode('buy')} className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-md ${mode === 'buy' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}><ArrowUpRight size={15} />Buy</button>
            <button onClick={() => setMode('sell')} className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-md ${mode === 'sell' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}><ArrowDownLeft size={15} />Sell</button>
          </div>
          <p className="text-sm text-gray-500 mb-3">{mode === 'buy' ? 'Buy' : 'Sell'} <span className="font-medium text-gray-900">{selected}</span> at {fmt(sel.price)}/share {mode === 'sell' && <span className="text-gray-400">· you own {ownedShares}</span>}</p>
          <label className="block text-sm font-medium text-gray-700 mb-1">Shares</label>
          <input type="text" inputMode="decimal" value={shares} placeholder="0" onChange={e => setShares(e.target.value.replace(/[^0-9.]/g, ''))} className="input w-full mb-2" />
          <p className="text-xs text-gray-400 mb-4">Estimated {mode === 'buy' ? 'cost' : 'proceeds'}: <span className="font-medium text-gray-700">{fmt(estCost)}</span></p>
          {mode === 'buy'
            ? <button onClick={() => { if (sh <= 0) { toast.error('Enter shares'); return; } buyMut.mutate(); }} disabled={buyMut.isPending} className="btn-primary w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50">{buyMut.isPending ? 'Buying…' : `Buy ${selected}`}</button>
            : <button onClick={() => { if (sh <= 0) { toast.error('Enter shares'); return; } if (sh > ownedShares) { toast.error('More than you own'); return; } sellMut.mutate(); }} disabled={sellMut.isPending} className="btn-primary w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50">{sellMut.isPending ? 'Submitting…' : `Request sell ${selected}`}</button>}
        </div>
      )}

      {/* Enrollment states */}
      {!status && (
        <div className="card p-6 max-w-xl">
          <div className="flex items-center gap-2 mb-1"><Lock size={16} className="text-emerald-700" /><h2 className="font-semibold text-gray-900">Enroll to start investing</h2></div>
          <p className="text-sm text-gray-500 mb-4">Choose the account you'll invest from. Your request will be reviewed before buying and selling is unlocked.</p>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className="input w-full mb-4">
            <option value="">Select an account…</option>
            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.account_type} ••••{String(a.account_number).slice(-4)} — {fmt(a.available_balance)}</option>)}
          </select>
          <button onClick={() => { if (!accountId) { toast.error('Choose an account'); return; } enrollMut.mutate(); }} disabled={enrollMut.isPending} className="btn-primary w-full bg-emerald-700 hover:bg-emerald-800">{enrollMut.isPending ? 'Submitting…' : 'Request enrollment'}</button>
        </div>
      )}
      {status === 'pending' && (
        <div className="card p-6 flex items-start gap-3"><Clock className="text-amber-500 flex-shrink-0 mt-0.5" size={20} /><div><p className="font-medium text-gray-900">Enrollment under review</p><p className="text-sm text-gray-500">You can browse the market now. Buying and selling unlock once an administrator approves your account.</p></div></div>
      )}
      {status === 'rejected' && (
        <div className="card p-6 max-w-xl">
          <div className="flex items-start gap-3 mb-4"><XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} /><div><p className="font-medium text-gray-900">Enrollment declined</p>{data?.account?.reject_reason && <p className="text-sm text-gray-500 italic">"{data.account.reject_reason}"</p>}</div></div>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className="input w-full mb-3"><option value="">Select an account…</option>{accounts.map((a: any) => <option key={a.id} value={a.id}>{a.account_type} ••••{String(a.account_number).slice(-4)}</option>)}</select>
          <button onClick={() => { if (!accountId) { toast.error('Choose an account'); return; } enrollMut.mutate(); }} className="btn-primary w-full bg-emerald-700 hover:bg-emerald-800">Request again</button>
        </div>
      )}

      {/* Holdings */}
      {status === 'active' && holdings.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Your holdings</h3></div>
          <div className="divide-y divide-gray-100">
            {holdings.map((h: any) => (
              <div key={h.symbol} className="flex items-center justify-between p-4">
                <div><p className="font-medium text-gray-900 text-sm">{h.symbol}</p><p className="text-xs text-gray-400">{h.shares} shares · avg {fmt(h.avg_price)}</p></div>
                <div className="text-right"><p className="font-semibold text-gray-900 text-sm">{fmt(h.value)}</p><p className={`text-xs ${h.gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>{h.gain >= 0 ? '+' : ''}{fmt(h.gain)}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
