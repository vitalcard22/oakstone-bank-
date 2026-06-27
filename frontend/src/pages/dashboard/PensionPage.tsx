import { useState } from 'react';
import { Landmark, TrendingUp, Calendar, ShieldCheck, Info, ChevronDown, ChevronUp } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const CONTRIBUTIONS = [
  { date: 'Jun 2026', amount: 200, type: 'Monthly contribution', relief: 50 },
  { date: 'May 2026', amount: 200, type: 'Monthly contribution', relief: 50 },
  { date: 'Apr 2026', amount: 500, type: 'Lump sum', relief: 125 },
  { date: 'Mar 2026', amount: 200, type: 'Monthly contribution', relief: 50 },
  { date: 'Feb 2026', amount: 200, type: 'Monthly contribution', relief: 50 },
];

const FAQ = [
  { q: 'When can I access my pension?', a: 'You can start withdrawing from age 55 (rising to 57 in 2028). Up to 25% can be taken as a tax-free lump sum.' },
  { q: 'How does tax relief work?', a: 'For every $80 you contribute, the government adds $20 in basic rate tax relief, making your effective contribution $100.' },
  { q: 'Is my pension protected?', a: 'FDIC insurance covers eligible deposits up to $250,000. This is a prototype system for demonstration purposes.' },
  { q: 'Can I transfer an existing pension?', a: 'Yes. You can roll over a 401(k) or IRA from a previous employer into your Oakstones 401(k).' },
];

export default function PensionPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const balance = 12450.00;
  const contributions = 4200.00;
  const taxRelief = 1050.00;
  const projected = 287500.00;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-800 to-blue-600 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Landmark size={18} className="text-blue-300" />
          <span className="text-blue-300 text-sm font-medium">401(k) Retirement Plan</span>
        </div>
        <h1 className="text-3xl font-bold mb-1">Your Pension</h1>
        <p className="text-blue-200 text-sm mb-6">Tax-advantaged retirement savings</p>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Current value', value: fmt(balance) },
            { label: 'Total contributions', value: fmt(contributions) },
            { label: 'Tax relief earned', value: fmt(taxRelief) },
            { label: 'Projected at 65', value: fmt(projected) },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-3">
              <p className="text-blue-200 text-xs mb-1">{s.label}</p>
              <p className="text-white font-bold text-lg">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Contribution form */}
        <div className="col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Make a contribution</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Contribution type</label>
                <select className="input">
                  <option>Monthly standing order</option>
                  <option>One-off lump sum</option>
                  <option>Employer contribution</option>
                </select>
              </div>
              <div>
                <label className="label">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input type="number" className="input pl-7" placeholder="200.00" min="50" />
                </div>
                <p className="text-xs text-blue-600 mt-1">Minimum contribution: $50. Tax relief will be added automatically.</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 flex gap-2">
                <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">Based on basic rate tax relief (20%), a $200 contribution costs you $160. Oakstones adds $40 on your behalf.</p>
              </div>
              <button className="btn-primary w-full py-3">Contribute to pension</button>
            </div>
          </div>

          {/* Contribution history */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Contribution history</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="text-left pb-2">Date</th>
                  <th className="text-left pb-2">Type</th>
                  <th className="text-right pb-2">Amount</th>
                  <th className="text-right pb-2">Tax relief</th>
                </tr>
              </thead>
              <tbody>
                {CONTRIBUTIONS.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 text-gray-500">{c.date}</td>
                    <td className="py-3 text-gray-700">{c.type}</td>
                    <td className="py-3 text-right font-mono text-gray-900">{fmt(c.amount)}</td>
                    <td className="py-3 text-right font-mono text-green-600">+{fmt(c.relief)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Key facts */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Key facts</h3>
            <div className="space-y-3">
              {[
                { icon: TrendingUp, label: 'Annual allowance', value: '$60,000' },
                { icon: Calendar, label: 'Access from age', value: '55' },
                { icon: ShieldCheck, label: 'FDIC insured', value: 'Up to $250k' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <f.icon size={14} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{f.label}</p>
                    <p className="text-sm font-semibold text-gray-900">{f.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Projection */}
          <div className="card p-5 bg-gradient-to-b from-blue-50 to-white">
            <h3 className="font-semibold text-gray-900 mb-1 text-sm">Retirement projection</h3>
            <p className="text-xs text-gray-400 mb-3">Based on $200/mo at 6% growth</p>
            <div className="space-y-2">
              {[
                { age: 'Age 45', value: '$48,200' },
                { age: 'Age 55', value: '$134,500' },
                { age: 'Age 65', value: '$287,500' },
              ].map(p => (
                <div key={p.age} className="flex justify-between text-sm">
                  <span className="text-gray-500">{p.age}</span>
                  <span className="font-semibold text-blue-700">{p.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risk warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-800 font-semibold mb-1">Important</p>
            <p className="text-xs text-amber-700">The value of your pension can go down as well as up. You may get back less than you put in. This is a prototype system.</p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Frequently asked questions</h2>
        <div className="space-y-2">
          {FAQ.map((f, i) => (
            <div key={i} className="border border-gray-100 rounded-lg overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors"
              >
                {f.q}
                {openFaq === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4 text-sm text-gray-500">{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}