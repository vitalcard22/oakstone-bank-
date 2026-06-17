import { useState } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Info } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;

const CHART_DATA = [
  { month: 'Jan', value: 10000 }, { month: 'Feb', value: 10800 },
  { month: 'Mar', value: 10200 }, { month: 'Apr', value: 11500 },
  { month: 'May', value: 12100 }, { month: 'Jun', value: 13240 },
];

const HOLDINGS = [
  { name: 'S&P 500 ETF', ticker: 'SPY', shares: 12, price: 524.30, change: 1.24, value: 6291.60, allocation: 47.5 },
  { name: 'Nasdaq 100 ETF', ticker: 'QQQ', shares: 8, price: 448.20, change: -0.82, value: 3585.60, allocation: 27.1 },
  { name: 'Global Bonds ETF', ticker: 'AGG', shares: 15, price: 98.40, change: 0.12, value: 1476.00, allocation: 11.1 },
  { name: 'Gold ETF', ticker: 'GLD', shares: 5, price: 214.60, change: 0.54, value: 1073.00, allocation: 8.1 },
  { name: 'Cash', ticker: 'USD', shares: null, price: null, change: 0, value: 814.00, allocation: 6.2 },
];

export default function InvestmentPage() {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const totalValue = 13240.20;
  const totalGain = 3240.20;
  const gainPct = 32.40;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-800 to-emerald-600 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={18} className="text-emerald-300" />
          <span className="text-emerald-300 text-sm font-medium">Investment Dealing Account (IDA)</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-1">{fmt(totalValue)}</h1>
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-300" />
              <span className="text-emerald-300 text-sm">{fmt(totalGain)} ({pct(gainPct)}) all time</span>
            </div>
          </div>
          <button className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm px-3 py-2 rounded-lg transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-4">
          {[
            { label: 'Invested', value: fmt(10000) },
            { label: 'Today\'s change', value: '+$142.30' },
            { label: 'Cash available', value: fmt(814) },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-3">
              <p className="text-emerald-200 text-xs mb-1">{s.label}</p>
              <p className="text-white font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {/* Chart */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Portfolio performance</h2>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={CHART_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => [fmt(v), 'Value']} contentStyle={{ borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Area type="monotone" dataKey="value" stroke="#1F6B4A" strokeWidth={2} fill="#1F6B4A" fillOpacity={0.08} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Holdings */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Holdings</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="text-left pb-2">Asset</th>
                  <th className="text-right pb-2">Price</th>
                  <th className="text-right pb-2">Change</th>
                  <th className="text-right pb-2">Value</th>
                  <th className="text-right pb-2">Allocation</th>
                </tr>
              </thead>
              <tbody>
                {HOLDINGS.map(h => (
                  <tr key={h.ticker} className="border-b border-gray-50 last:border-0">
                    <td className="py-3">
                      <p className="font-medium text-gray-900">{h.name}</p>
                      <p className="text-xs text-gray-400">{h.ticker}{h.shares ? ` · ${h.shares} shares` : ''}</p>
                    </td>
                    <td className="py-3 text-right font-mono text-gray-700">{h.price ? fmt(h.price) : '—'}</td>
                    <td className={`py-3 text-right font-mono text-sm ${h.change > 0 ? 'text-green-600' : h.change < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {h.change !== 0 ? pct(h.change) : '—'}
                    </td>
                    <td className="py-3 text-right font-mono font-semibold text-gray-900">{fmt(h.value)}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${h.allocation}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{h.allocation}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trade panel */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg">
              {(['buy', 'sell'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Asset</label>
                <select className="input">
                  <option>S&P 500 ETF (SPY)</option>
                  <option>Nasdaq 100 ETF (QQQ)</option>
                  <option>Global Bonds (AGG)</option>
                  <option>Gold ETF (GLD)</option>
                </select>
              </div>
              <div>
                <label className="label">Amount ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input type="number" className="input pl-7" placeholder="500.00" />
                </div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 flex gap-2">
                <Info size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-700">No trading fees on ETFs. Fractional shares supported.</p>
              </div>
              <button className={`w-full py-3 rounded-lg text-white text-sm font-medium transition-colors ${tab === 'buy' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-red-600 hover:bg-red-700'}`}>
                {tab === 'buy' ? 'Place buy order' : 'Place sell order'}
              </button>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Market hours</h3>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-sm text-gray-700">Market open</span>
            </div>
            <p className="text-xs text-gray-400">NYSE closes at 4:00 PM ET. Orders placed after hours execute at next open.</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-800 font-semibold mb-1">Risk warning</p>
            <p className="text-xs text-amber-700">Capital at risk. Past performance is not a reliable indicator of future results. This is a prototype.</p>
          </div>
        </div>
      </div>
    </div>
  );
}