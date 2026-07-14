import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wealthApi, accountApi } from '../../services/api';
import toast from 'react-hot-toast';
import { PiggyBank, ShieldCheck, TrendingUp, ArrowUpRight, ArrowDownLeft, Sparkles, Clock, XCircle } from 'lucide-react';

const fmt = (n: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));

function Gauge({ pct }: { pct: number }) {
  const r = 52, c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(1, pct / 100));
  return (
    <svg viewBox="0 0 130 130" className="w-32 h-32 -rotate-90">
      <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="11" />
      <circle cx="65" cy="65" r={r} fill="none" stroke="white" strokeWidth="11" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .7s ease' }} />
      <text x="65" y="60" transform="rotate(90 65 65)" textAnchor="middle" className="fill-white font-bold" style={{ fontSize: 22 }}>{Math.round(pct)}%</text>
      <text x="65" y="80" transform="rotate(90 65 65)" textAnchor="middle" className="fill-white/70" style={{ fontSize: 9 }}>allowance used</text>
    </svg>
  );
}

export default function ISAPage() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'add' | 'withdraw'>('add');
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['isa'], queryFn: () => wealthApi.isa().then(r => r.data) });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => accountApi.list().then(r => r.data) });

  const isa = data?.isa;
  const status = isa?.status ?? null;
  const balance = Number(isa?.balance ?? 0);
  const used = Number(isa?.allowance_used ?? 0);
  const allowance = Number(data?.config?.allowance ?? 7000);
  const rate = Number(isa?.interest_rate ?? data?.config?.rate ?? 4.75);
  const remaining = Math.max(0, allowance - used);
  const pct = (used / allowance) * 100;
  const projectedInterest = balance * (rate / 100);
  const amt = parseFloat(amount) || 0;
  const pendingWithdrawal = Number(data?.pendingWithdrawal ?? 0);

  const refresh = () => { qc.invalidateQueries({ queryKey: ['isa'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); };

  const enrollMut = useMutation({ mutationFn: () => wealthApi.enrollIsa(accountId), onSuccess: () => { refresh(); toast.success('Enrollment requested'); }, onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed') });
  const addMut = useMutation({ mutationFn: () => wealthApi.contributeIsa({ accountId, amount: amt }), onSuccess: () => { refresh(); setAmount(''); toast.success('Added to your Roth IRA'); }, onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed') });
  const wMut = useMutation({ mutationFn: () => wealthApi.withdrawIsa(amt), onSuccess: () => { refresh(); setAmount(''); toast.success('Withdrawal request submitted for approval'); }, onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed') });

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-800 via-purple-700 to-indigo-600 rounded-2xl p-6 sm:p-8 text-white">
        <Sparkles className="absolute -right-6 -top-6 text-white/10" size={140} />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 relative">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <PiggyBank size={18} className="text-purple-200" />
              <span className="text-purple-200 text-sm font-medium">Roth IRA</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white/15 px-2 py-0.5 rounded-full"><ShieldCheck size={11} />Tax-free</span>
            </div>
            {status === 'active' ? (
              <>
                <p className="text-purple-200 text-xs uppercase tracking-wider mb-1">Your Roth IRA balance</p>
                <h1 className="text-4xl sm:text-5xl font-bold mb-2 break-words">{fmt(balance)}</h1>
                <p className="text-purple-100 text-sm flex items-center gap-1.5"><TrendingUp size={14} /> {rate.toFixed(2)}% APY · earns about <span className="font-semibold">{fmt(projectedInterest)}</span>/yr tax-free</p>
              </>
            ) : (
              <>
                <h1 className="text-3xl sm:text-4xl font-bold mb-2">Save tax-free for retirement</h1>
                <p className="text-purple-100 text-sm max-w-md">Contribute up to {fmt(allowance)} a year. Your earnings grow completely tax-free. Enroll once, then add money anytime.</p>
              </>
            )}
          </div>
          {status === 'active' && (
            <div className="flex-shrink-0 self-center text-center">
              <Gauge pct={pct} />
              <p className="text-purple-200 text-xs mt-1">{fmt(remaining)} left this year</p>
            </div>
          )}
        </div>
      </div>

      {/* NOT ENROLLED */}
      {!status && (
        <div className="card p-6 max-w-xl">
          <h2 className="font-semibold text-gray-900 mb-1">Enroll in a Roth IRA</h2>
          <p className="text-sm text-gray-500 mb-4">Choose the account you'll contribute from. Your request will be reviewed before your Roth IRA is activated.</p>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className="input w-full mb-4">
            <option value="">Select an account…</option>
            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.account_type} ••••{String(a.account_number).slice(-4)} — {fmt(a.available_balance)}</option>)}
          </select>
          <button onClick={() => { if (!accountId) { toast.error('Choose an account'); return; } enrollMut.mutate(); }} disabled={enrollMut.isPending} className="btn-primary w-full bg-purple-700 hover:bg-purple-800">{enrollMut.isPending ? 'Submitting…' : 'Request enrollment'}</button>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
            {[{ l: 'Annual limit', v: fmt(allowance) }, { l: 'Rate', v: `${rate.toFixed(2)}% APY` }, { l: 'Tax', v: 'Tax-free' }].map(s => (
              <div key={s.l} className="bg-gray-50 rounded-lg p-3 text-center"><p className="text-[11px] text-gray-400">{s.l}</p><p className="text-sm font-semibold text-gray-900">{s.v}</p></div>
            ))}
          </div>
        </div>
      )}

      {/* PENDING */}
      {status === 'pending' && (
        <div className="card p-6 flex items-start gap-3"><Clock className="text-amber-500 flex-shrink-0 mt-0.5" size={20} /><div><p className="font-medium text-gray-900">Enrollment under review</p><p className="text-sm text-gray-500">An administrator is reviewing your Roth IRA enrollment. You'll be able to contribute once it's approved.</p></div></div>
      )}

      {/* REJECTED */}
      {status === 'rejected' && (
        <div className="card p-6 max-w-xl">
          <div className="flex items-start gap-3 mb-4"><XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} /><div><p className="font-medium text-gray-900">Enrollment declined</p>{isa?.reject_reason && <p className="text-sm text-gray-500 italic">"{isa.reject_reason}"</p>}</div></div>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className="input w-full mb-3"><option value="">Select an account…</option>{accounts.map((a: any) => <option key={a.id} value={a.id}>{a.account_type} ••••{String(a.account_number).slice(-4)}</option>)}</select>
          <button onClick={() => { if (!accountId) { toast.error('Choose an account'); return; } enrollMut.mutate(); }} className="btn-primary w-full bg-purple-700 hover:bg-purple-800">Request again</button>
        </div>
      )}

      {/* ACTIVE */}
      {status === 'active' && (
        <>
          {pendingWithdrawal > 0 && (
            <div className="card p-4 flex items-start gap-3 border-amber-200 bg-amber-50">
              <Clock className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
              <div><p className="font-medium text-gray-900 text-sm">Withdrawal pending approval</p><p className="text-xs text-gray-500">{fmt(pendingWithdrawal)} is awaiting admin approval before it reaches your account.</p></div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Annual allowance', value: fmt(allowance), sub: `Tax year ${data?.config?.taxYear ?? ''}` },
              { label: 'Used this year', value: fmt(used), sub: `${Math.round(pct)}% of allowance` },
              { label: 'Remaining', value: fmt(remaining), sub: 'Available to add' },
            ].map(s => (
              <div key={s.label} className="card p-4"><p className="text-xs text-gray-400 mb-1">{s.label}</p><p className="text-lg font-bold text-gray-900 break-words">{s.value}</p><p className="text-[11px] text-gray-400">{s.sub}</p></div>
            ))}
          </div>

          <div className="card p-6 max-w-xl">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-5">
              <button onClick={() => setMode('add')} className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-md transition-colors ${mode === 'add' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'}`}><ArrowUpRight size={15} />Add money</button>
              <button onClick={() => setMode('withdraw')} className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-md transition-colors ${mode === 'withdraw' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'}`}><ArrowDownLeft size={15} />Withdraw</button>
            </div>
            {mode === 'add' && (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1">From account</label>
                <select value={accountId} onChange={e => setAccountId(e.target.value)} className="input w-full mb-4"><option value="">Select an account…</option>{accounts.map((a: any) => <option key={a.id} value={a.id}>{a.account_type} ••••{String(a.account_number).slice(-4)} — {fmt(a.available_balance)}</option>)}</select>
              </>
            )}
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <input type="text" inputMode="decimal" value={amount} placeholder="0.00" onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, '').replace(/^0+(?=\d)/, ''))} className="input w-full mb-2" />
            {mode === 'add' ? <p className="text-xs text-gray-400 mb-4">{fmt(remaining)} of your allowance remaining this tax year.</p> : <p className="text-xs text-gray-400 mb-4">{fmt(balance)} available. Withdrawals are reviewed by an administrator before payout.</p>}
            {mode === 'add'
              ? <button onClick={() => { if (!accountId) { toast.error('Choose an account'); return; } if (amt <= 0) { toast.error('Enter an amount'); return; } if (amt > remaining) { toast.error('Exceeds your remaining allowance'); return; } addMut.mutate(); }} disabled={addMut.isPending} className="btn-primary w-full bg-purple-700 hover:bg-purple-800 disabled:opacity-50">{addMut.isPending ? 'Adding…' : 'Add to Roth IRA'}</button>
              : <button onClick={() => { if (amt <= 0) { toast.error('Enter an amount'); return; } if (amt > balance) { toast.error('More than your balance'); return; } wMut.mutate(); }} disabled={wMut.isPending} className="btn-primary w-full bg-purple-700 hover:bg-purple-800 disabled:opacity-50">{wMut.isPending ? 'Submitting…' : 'Request withdrawal'}</button>}
            <p className="text-xs text-gray-400 mt-3 flex items-start gap-1.5"><ShieldCheck size={13} className="flex-shrink-0 mt-0.5 text-purple-600" />Earnings in your Roth IRA grow tax-free. You can contribute up to {fmt(allowance)} each tax year.</p>
          </div>
        </>
      )}
    </div>
  );
}
