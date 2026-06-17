import { useState } from 'react';
import { Lock, Calendar, ShieldCheck, Info } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const TERMS = [
  { months: 3, rate: 4.50, label: '3 months' },
  { months: 6, rate: 4.85, label: '6 months' },
  { months: 12, rate: 5.20, label: '12 months' },
  { months: 24, rate: 5.45, label: '24 months' },
];

const ACTIVE_DEPOSITS = [
  { amount: 5000, rate: 5.20, term: '12 months', maturity: 'Jun 2027', interest: 260, status: 'Active' },
  { amount: 2000, rate: 4.85, term: '6 months', maturity: 'Sep 2026', interest: 48.50, status: 'Active' },
];

export default function FixedDepositPage() {
  const [selectedTerm, setSelectedTerm] = useState(TERMS[2]);
  const [amount, setAmount] = useState(5000);
  const projectedInterest = (amount * (selectedTerm.rate / 100) * (selectedTerm.months / 12));

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-amber-700 to-amber-500 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Lock size={18} className="text-amber-200" />
          <span className="text-amber-200 text-sm font-medium">Fixed Deposit Account</span>
        </div>
        <h1 className="text-3xl font-bold mb-1">Guaranteed returns</h1>
        <p className="text-amber-100 text-sm mb-6">Lock in your rate. Know exactly what you'll earn.</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Best available rate', value: '5.45% AER' },
            { label: 'Total deposited', value: fmt(7000) },
            { label: 'Interest earning', value: fmt(308.50) },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-3">
              <p className="text-amber-200 text-xs mb-1">{s.label}</p>
              <p className="text-white font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {/* New deposit form */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Open a new fixed deposit</h2>
            <div className="space-y-4">
              {/* Term selection */}
              <div>
                <label className="label">Select term</label>
                <div className="grid grid-cols-4 gap-2">
                  {TERMS.map(t => (
                    <button
                      key={t.months}
                      onClick={() => setSelectedTerm(t)}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${selectedTerm.months === t.months ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-amber-200'}`}
                    >
                      <p className="text-xs text-gray-500 mb-1">{t.label}</p>
                      <p className="font-bold text-amber-700">{t.rate}%</p>
                      <p className="text-xs text-gray-400">AER</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="label">Deposit amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    className="input pl-7"
                    value={amount}
                    onChange={e => setAmount(Number(e.target.value))}
                    min={1000}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Minimum deposit: $1,000</p>
              </div>

              {/* Projected return */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-amber-800">Projected at maturity</span>
                  <span className="text-lg font-bold text-amber-700">{fmt(amount + projectedInterest)}</span>
                </div>
                <div className="flex justify-between text-xs text-amber-600">
                  <span>Interest earned</span>
                  <span>+{fmt(projectedInterest)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Info size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-500">Early withdrawal is not permitted during the fixed term. At maturity, funds return to your main account automatically.</p>
              </div>

              <button className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg text-sm font-medium transition-colors">
                Open fixed deposit — {selectedTerm.rate}% for {selectedTerm.label}
              </button>
            </div>
          </div>

          {/* Active deposits */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Active deposits</h2>
            <div className="space-y-3">
              {ACTIVE_DEPOSITS.map((d, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{fmt(d.amount)}</p>
                      <p className="text-xs text-gray-400">{d.term} · {d.rate}% AER</p>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">{d.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400" />
                      <span className="text-gray-500">Matures: <span className="text-gray-900 font-medium">{d.maturity}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Lock size={14} className="text-gray-400" />
                      <span className="text-gray-500">Interest: <span className="text-green-600 font-medium">+{fmt(d.interest)}</span></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Rate table</h3>
            <div className="space-y-2">
              {TERMS.map(t => (
                <div key={t.months} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-600">{t.label}</span>
                  <span className="font-bold text-amber-700">{t.rate}%</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">Rates correct as of today. Subject to change before account opening.</p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-2">
            <ShieldCheck size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-green-800 font-semibold mb-1">FSCS Protected</p>
              <p className="text-xs text-green-700">Deposits protected up to $85,000 per person.</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 font-semibold mb-2">Important information</p>
            <p className="text-xs text-gray-400">Fixed deposits cannot be accessed early. Ensure you won't need these funds before the maturity date. This is a prototype system.</p>
          </div>
        </div>
      </div>
    </div>
  );
}