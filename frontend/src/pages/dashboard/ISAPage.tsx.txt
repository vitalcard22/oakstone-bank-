import { PiggyBank, ShieldCheck, TrendingUp, Info } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function ISAPage() {
  const balance = 8750.00;
  const annualAllowance = 20000;
  const used = 8750;
  const remaining = annualAllowance - used;
  const interestEarned = 312.45;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-purple-800 to-purple-600 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-2 mb-3">
          <PiggyBank size={18} className="text-purple-300" />
          <span className="text-purple-300 text-sm font-medium">Individual Savings Account (ISA)</span>
        </div>
        <h1 className="text-4xl font-bold mb-1">{fmt(balance)}</h1>
        <p className="text-purple-200 text-sm mb-6">Tax-free savings balance</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Interest earned (tax-free)', value: fmt(interestEarned) },
            { label: 'Annual allowance used', value: fmt(used) },
            { label: 'Remaining allowance', value: fmt(remaining) },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-3">
              <p className="text-purple-200 text-xs mb-1">{s.label}</p>
              <p className="text-white font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {/* Allowance progress */}
          <div className="card p-6">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold text-gray-900">Annual ISA allowance</h2>
              <span className="text-sm text-gray-500">{fmt(used)} of {fmt(annualAllowance)}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-purple-600 rounded-full transition-all" style={{ width: `${(used / annualAllowance) * 100}%` }} />
            </div>
            <p className="text-xs text-gray-400">You have {fmt(remaining)} remaining in your {new Date().getFullYear()}/{new Date().getFullYear() + 1} ISA allowance.</p>
          </div>

          {/* Deposit form */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Add to ISA</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Deposit amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input type="number" className="input pl-7" placeholder="0.00" max={remaining} />
                </div>
                <p className="text-xs text-purple-600 mt-1">Maximum deposit: {fmt(remaining)} (remaining allowance)</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 flex gap-2">
                <Info size={14} className="text-purple-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-purple-700">All interest earned in your ISA is completely tax-free. No need to declare it on your tax return.</p>
              </div>
              <button className="w-full bg-purple-700 hover:bg-purple-800 text-white py-3 rounded-lg text-sm font-medium transition-colors">
                Deposit to ISA
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">ISA details</h3>
            <div className="space-y-3">
              {[
                { label: 'Interest rate', value: '4.85% AER' },
                { label: 'Rate type', value: 'Variable' },
                { label: 'Withdrawals', value: 'Flexible' },
                { label: 'FSCS protected', value: 'Yes — up to $85k' },
                { label: 'Account type', value: 'Cash ISA' },
              ].map(d => (
                <div key={d.label} className="flex justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                  <span className="text-gray-400">{d.label}</span>
                  <span className="font-medium text-gray-900">{d.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5 bg-gradient-to-b from-purple-50 to-white">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-purple-600" />
              <h3 className="font-semibold text-gray-900 text-sm">Projected growth</h3>
            </div>
            <div className="space-y-2">
              {[
                { period: '1 year', value: '$9,174' },
                { period: '3 years', value: '$10,084' },
                { period: '5 years', value: '$11,078' },
              ].map(p => (
                <div key={p.period} className="flex justify-between text-sm">
                  <span className="text-gray-400">{p.period}</span>
                  <span className="font-semibold text-purple-700">{p.value}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">Based on current 4.85% AER. Rate may change.</p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-2">
            <ShieldCheck size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-green-800 font-semibold mb-1">FSCS Protected</p>
              <p className="text-xs text-green-700">Your ISA is protected up to $85,000 per person.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}