import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wealthApi, accountApi } from '../../services/api';
import toast from 'react-hot-toast';
import { Landmark, ShieldCheck, Clock, XCircle, TrendingUp, ArrowUpRight, ArrowDownLeft, Info } from 'lucide-react';

const fmt = (n: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n || 0));
const fmt2 = (n: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));

function Gauge({ pct }: { pct: number }) {
  const r = 50, c = 2 * Math.PI * r, off = c * (1 - Math.min(1, pct / 100));
  return (
    <svg viewBox="0 0 124 124" className="w-28 h-28 -rotate-90">
      <circle cx="62" cy="62" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="10" />
      <circle cx="62" cy="62" r={r} fill="none" stroke="white" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .7s ease' }} />
      <text x="62" y="58" transform="rotate(90 62 62)" textAnchor="middle" className="fill-white font-bold" style={{ fontSize: 20 }}>{Math.round(pct)}%</text>
      <text x="62" y="76" transform="rotate(90 62 62)" textAnchor="middle" className="fill-white/70" style={{ fontSize: 8 }}>of limit used</text>
    </svg>
  );
}

export default function PensionPage() {
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState('');
  const [mode, setMode] = useState<'add' | 'withdraw'>('add');
  const [amount, setAmount] = useState('');
  const [years, setYears] = useState(30);
  const [annual, setAnnual] = useState('6000');

  const { data, isLoading } = useQuery({ queryKey: ['retirement'], queryFn: () => wealthApi.retirement().then(r => r.data) });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => accountApi.list().then(r => r.data) });

  const plan = data?.plan;
  const limit = Number(data?.config?.limit ?? 23500);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['retirement'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); };

  const enrollMut = useMutation({
    mutationFn: () => wealthApi.enrollRetirement(accountId),
    onSuccess: () => { refresh(); toast.success('Enrollment requested'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });
  const addMut = useMutation({
    mutationFn: () => wealthApi.contributeRetirement(parseFloat(amount) || 0),
    onSuccess: () => { refresh(); setAmount(''); toast.success('Added to your 401(k)'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });
  const wMut = useMutation({
    mutationFn: () => wealthApi.withdrawRetirement(parseFloat(amount) || 0),
    onSuccess: () => { refresh(); setAmount(''); toast.success('Withdrawn to your account'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>;

  const balance = Number(plan?.balance ?? 0);
  const used = Number(plan?.contribution_used ?? 0);
  const remaining = Math.max(0, limit - used);
  const pct = (used / limit) * 100;
  const amt = parseFloat(amount) || 0;

  // Retirement projection (clearly a projection, 7% assumed annual return)
  const r = 0.07, ann = parseFloat(annual) || 0;
  const projected = balance * Math.pow(1 + r, years) + ann * ((Math.pow(1 + r, years) - 1) / r);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-600 rounded-2xl p-6 sm:p-8 text-white">
        <Landmark className="absolute -right-5 -top-5 text-white/10" size={130} />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 relative">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Landmark size={18} className="text-blue-200" />
              <span className="text-blue-200 text-sm font-medium">401(k) Retirement Plan</span>
            </div>
            {plan?.status === 'active' ? (
              <>
                <p className="text-blue-200 text-xs uppercase tracking-wider mb-1">Your 401(k) balance</p>
                <h1 className="text-4xl sm:text-5xl font-bold mb-2 break-words">{fmt2(balance)}</h1>
                <p className="text-blue-100 text-sm">{fmt(remaining)} of your {fmt(limit)} limit left this year</p>
              </>
            ) : (
              <>
                <h1 className="text-3xl sm:text-4xl font-bold mb-2">Save for retirement</h1>
                <p className="text-blue-100 text-sm max-w-md">Contribute up to {fmt(limit)} a year toward your retirement. Enroll once, then add money anytime.</p>
              </>
            )}
          </div>
          {plan?.status === 'active' && (
            <div className="flex-shrink-0 self-center"><Gauge pct={pct} /></div>
          )}
        </div>
      </div>

      {/* NOT ENROLLED */}
      {!plan && (
        <div className="card p-6 max-w-xl">
          <h2 className="font-semibold text-gray-900 mb-1">Enroll in the Oakstones 401(k)</h2>
          <p className="text-sm text-gray-500 mb-4">Choose the account you'll contribute from. Your request will be reviewed before your plan is activated.</p>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className="input w-full mb-4">
            <option value="">Select an account…</option>
            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.account_type} ••••{String(a.account_number).slice(-4)} — {fmt2(a.available_balance)}</option>)}
          </select>
          <button onClick={() => { if (!accountId) { toast.error('Choose an account'); return; } enrollMut.mutate(); }} disabled={enrollMut.isPending} className="btn-primary w-full bg-blue-700 hover:bg-blue-800">
            {enrollMut.isPending ? 'Submitting…' : 'Request enrollment'}
          </button>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
            {[
              { Icon: TrendingUp, label: 'Annual limit', value: fmt(limit) },
              { Icon: ShieldCheck, label: 'FDIC insured', value: 'Up to $250k' },
              { Icon: Landmark, label: 'Tax-advantaged', value: 'Retirement' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
                <s.Icon size={16} className="mx-auto text-blue-600 mb-1" />
                <p className="text-[11px] text-gray-400">{s.label}</p>
                <p className="text-sm font-semibold text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PENDING */}
      {plan?.status === 'pending' && (
        <div className="card p-6 flex items-start gap-3">
          <Clock className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
          <div><p className="font-medium text-gray-900">Enrollment under review</p><p className="text-sm text-gray-500">An administrator is reviewing your 401(k) enrollment. You'll be able to contribute once it's approved.</p></div>
        </div>
      )}

      {/* REJECTED */}
      {plan?.status === 'rejected' && (
        <div className="card p-6 max-w-xl">
          <div className="flex items-start gap-3 mb-4">
            <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div><p className="font-medium text-gray-900">Enrollment declined</p>{plan.reject_reason && <p className="text-sm text-gray-500 italic">"{plan.reject_reason}"</p>}</div>
          </div>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className="input w-full mb-3">
            <option value="">Select an account…</option>
            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.account_type} ••••{String(a.account_number).slice(-4)}</option>)}
          </select>
          <button onClick={() => { if (!accountId) { toast.error('Choose an account'); return; } enrollMut.mutate(); }} className="btn-primary w-full bg-blue-700 hover:bg-blue-800">Request again</button>
        </div>
      )}

      {/* ACTIVE */}
      {plan?.status === 'active' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Annual limit', value: fmt(limit), sub: `Tax year ${data?.config?.taxYear ?? ''}` },
              { label: 'Contributed', value: fmt2(used), sub: `${Math.round(pct)}% of limit` },
              { label: 'Remaining', value: fmt2(remaining), sub: 'Available to add' },
            ].map(s => (
              <div key={s.label} className="card p-4"><p className="text-xs text-gray-400 mb-1">{s.label}</p><p className="text-lg font-bold text-gray-900 break-words">{s.value}</p><p className="text-[11px] text-gray-400">{s.sub}</p></div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Add / withdraw */}
            <div className="card p-6">
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-5">
                <button onClick={() => setMode('add')} className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-md ${mode === 'add' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}><ArrowUpRight size={15} />Contribute</button>
                <button onClick={() => setMode('withdraw')} className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-md ${mode === 'withdraw' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}><ArrowDownLeft size={15} />Withdraw</button>
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <input type="text" inputMode="decimal" value={amount} placeholder="0.00" onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, '').replace(/^0+(?=\d)/, ''))} className="input w-full mb-2" />
              <p className="text-xs text-gray-400 mb-4">{mode === 'add' ? `${fmt2(remaining)} of your limit remaining.` : `${fmt2(balance)} available to withdraw.`}</p>
              {mode === 'add'
                ? <button onClick={() => { if (amt <= 0) { toast.error('Enter an amount'); return; } if (amt > remaining) { toast.error('Exceeds your remaining limit'); return; } addMut.mutate(); }} disabled={addMut.isPending} className="btn-primary w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50">{addMut.isPending ? 'Adding…' : 'Contribute'}</button>
                : <button onClick={() => { if (amt <= 0) { toast.error('Enter an amount'); return; } if (amt > balance) { toast.error('More than your balance'); return; } wMut.mutate(); }} disabled={wMut.isPending} className="btn-primary w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50">{wMut.isPending ? 'Withdrawing…' : 'Withdraw'}</button>}
            </div>

            {/* Projection */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-1"><TrendingUp size={16} className="text-blue-600" /><h3 className="font-semibold text-gray-900">Retirement projection</h3></div>
              <p className="text-3xl font-bold text-blue-700 my-2 break-words">{fmt(projected)}</p>
              <p className="text-xs text-gray-400 mb-4">Estimated value in {years} years</p>
              <label className="block text-xs font-medium text-gray-600 mb-1">Years until retirement: {years}</label>
              <input type="range" min={1} max={40} value={years} onChange={e => setYears(Number(e.target.value))} className="w-full mb-3 accent-blue-700" />
              <label className="block text-xs font-medium text-gray-600 mb-1">Assumed yearly contribution</label>
              <input type="text" inputMode="decimal" value={annual} onChange={e => setAnnual(e.target.value.replace(/[^0-9.]/g, '').replace(/^0+(?=\d)/, ''))} className="input w-full mb-2 text-sm py-1.5" />
              <p className="text-[11px] text-gray-400 flex items-start gap-1"><Info size={12} className="flex-shrink-0 mt-0.5" />Projection only, assuming a 7%/yr return. Not a guarantee — actual returns vary.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
