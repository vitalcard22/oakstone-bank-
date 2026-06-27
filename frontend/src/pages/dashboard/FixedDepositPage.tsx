import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wealthApi, accountApi } from '../../services/api';
import toast from 'react-hot-toast';
import { Lock, Calendar, Info, CheckCircle, Clock, XCircle } from 'lucide-react';

const fmt = (n: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export default function FixedDepositPage() {
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [termMonths, setTermMonths] = useState(12);

  const { data, isLoading } = useQuery({ queryKey: ['fixed-deposits'], queryFn: () => wealthApi.fixedDeposits().then(r => r.data) });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => accountApi.list().then(r => r.data) });

  const terms: { months: number; rate: number }[] = data?.terms ?? [];
  const minDeposit: number = data?.minDeposit ?? 500;
  const deposits: any[] = data?.deposits ?? [];

  const amt = parseFloat(amount) || 0;
  const selectedRate = terms.find(t => t.months === termMonths)?.rate ?? 0;
  const projectedInterest = amt * (selectedRate / 100) * (termMonths / 12);
  const projectedValue = amt + projectedInterest;

  const applyMut = useMutation({
    mutationFn: () => wealthApi.applyFixedDeposit({ accountId, principal: amt, termMonths }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fixed-deposits'] }); toast.success('Application submitted for review'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Could not submit application'),
  });

  const totalActive = deposits.filter(d => d.status === 'active').reduce((s, d) => s + Number(d.principal), 0);
  const totalInterest = deposits.filter(d => d.status === 'active').reduce((s, d) => s + (Number(d.maturity_value) - Number(d.principal)), 0);
  const bestRate = terms.length ? Math.max(...terms.map(t => t.rate)) : 0;

  const statusPill = (s: string) =>
    s === 'active' ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle size={12}/>Active</span>
    : s === 'pending' ? <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"><Clock size={12}/>Under review</span>
    : s === 'rejected' ? <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full"><XCircle size={12}/>Declined</span>
    : s === 'matured' ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle size={12}/>Matured · paid out</span>
    : <span className="text-xs text-gray-500">{s}</span>;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-amber-700 to-amber-500 rounded-2xl p-6 sm:p-8 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Lock size={18} className="text-amber-200" />
          <span className="text-amber-200 text-sm font-medium">Fixed Deposit Account</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">Guaranteed returns</h1>
        <p className="text-amber-100 text-sm mb-6">Lock in your rate. Know exactly what you'll earn.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Best available rate', value: `${bestRate.toFixed(2)}% AER` },
            { label: 'Total deposited', value: fmt(totalActive) },
            { label: 'Interest at maturity', value: fmt(totalInterest) },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-3">
              <p className="text-amber-200 text-xs mb-1">{s.label}</p>
              <p className="text-white font-bold break-words">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Apply form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Open a new fixed deposit</h2>

            <label className="block text-sm font-medium text-gray-700 mb-1">Fund from account</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)} className="input w-full mb-4">
              <option value="">Select an account…</option>
              {accounts.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.account_type} ••••{String(a.account_number).slice(-4)} — {fmt(a.available_balance)} available
                </option>
              ))}
            </select>

            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (min {fmt(minDeposit)})</label>
            <input
              type="text" inputMode="decimal" value={amount}
              placeholder={`Enter amount (min ${fmt(minDeposit)})`}
              onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, '').replace(/^0+(?=\d)/, ''))}
              className="input w-full mb-4" />

            <label className="block text-sm font-medium text-gray-700 mb-2">Term</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
              {terms.map(t => (
                <button key={t.months} type="button" onClick={() => setTermMonths(t.months)}
                  className={`rounded-lg border p-3 text-center transition-colors ${termMonths === t.months ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className="text-sm font-semibold text-gray-900">{t.months} mo</p>
                  <p className="text-xs text-amber-600 font-medium">{t.rate.toFixed(2)}%</p>
                </button>
              ))}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-5 space-y-1">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Projected interest</span><span className="font-medium text-gray-900">{fmt(projectedInterest)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Value at maturity</span><span className="font-bold text-amber-700">{fmt(projectedValue)}</span></div>
            </div>

            <button
              onClick={() => {
                if (!accountId) { toast.error('Choose a funding account'); return; }
                if (amt < minDeposit) { toast.error(`Minimum deposit is ${fmt(minDeposit)}`); return; }
                applyMut.mutate();
              }}
              disabled={applyMut.isPending || !accountId || amt < minDeposit}
              className="btn-primary w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50">
              {applyMut.isPending ? 'Submitting…' : 'Submit application'}
            </button>
            <p className="text-xs text-gray-400 mt-3 flex items-start gap-1.5">
              <Info size={13} className="flex-shrink-0 mt-0.5" />
              Funds are debited only after an administrator approves your application. Until then your money stays available.
            </p>
          </div>
        </div>

        {/* My deposits */}
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-900">Your deposits</h2>
          {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {!isLoading && deposits.length === 0 && (
            <div className="card p-5 text-center text-sm text-gray-400">No fixed deposits yet.</div>
          )}
          {deposits.map(d => (
            <div key={d.id} className="card p-4">
              <div className="flex justify-between items-start mb-2">
                <p className="font-bold text-gray-900">{fmt(d.principal)}</p>
                {statusPill(d.status)}
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <p>{d.term_months} months @ {Number(d.interest_rate).toFixed(2)}%</p>
                <p>From ••••{String(d.account_number).slice(-4)}</p>
                {d.status === 'active' && (
                  <>
                    <p className="flex items-center gap-1"><Calendar size={11}/>Matures {fmtDate(d.maturity_date)}</p>
                    <p className="text-amber-700 font-medium">Worth {fmt(d.maturity_value)} at maturity</p>
                  </>
                )}
                {d.status === 'matured' && <p className="text-emerald-700 font-medium">Paid out {fmt(d.maturity_value)} to ••••{String(d.account_number).slice(-4)}</p>}
                {d.status === 'rejected' && d.reject_reason && <p className="text-red-500 italic">{d.reject_reason}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
