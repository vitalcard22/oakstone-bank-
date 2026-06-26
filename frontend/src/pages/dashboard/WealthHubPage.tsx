import { useNavigate } from 'react-router-dom';
import { TrendingUp, Landmark, PiggyBank, Lock, ArrowRight, ShieldCheck } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const PRODUCTS = [
  {
    key: 'investment',
    icon: TrendingUp,
    color: 'bg-emerald-50 text-emerald-700',
    border: 'border-emerald-200',
    title: 'Investment Account',
    subtitle: 'IDA â€” Investment Dealing Account',
    description: 'Build long-term wealth with access to stocks, ETFs, bonds and more. Start with as little as $100.',
    features: ['Stocks & ETFs', 'Real-time portfolio tracking', 'Dividend reinvestment', 'No trading fees on ETFs'],
    rate: null,
    rateLabel: null,
    cta: 'Open Investment Account',
    path: '/investment',
    badge: 'Popular',
  },
  {
    key: 'pension',
    icon: Landmark,
    color: 'bg-blue-50 text-blue-700',
    border: 'border-blue-200',
    title: 'Pension (SIPP)',
    subtitle: 'Self-Invested Personal Pension',
    description: 'A tax-advantaged way to save for retirement. Contributions benefit from tax relief at your marginal rate.',
    features: ['Tax relief on contributions', 'Withdraw from age 55', '25% tax-free lump sum', 'Min. contribution $50/mo'],
    rate: null,
    rateLabel: null,
    cta: 'Open Pension Account',
    path: '/pension',
    badge: 'Tax advantaged',
  },
  {
    key: 'isa',
    icon: PiggyBank,
    color: 'bg-purple-50 text-purple-700',
    border: 'border-purple-200',
    title: 'ISA',
    subtitle: 'Individual Savings Account',
    description: 'Save up to $20,000 per year completely tax-free. Interest, dividends and gains are all sheltered.',
    features: ['Tax-free interest & gains', '$20,000 annual allowance', 'Flexible withdrawals', 'FSCS protected'],
    rate: '4.85%',
    rateLabel: 'AER (variable)',
    cta: 'Open ISA',
    path: '/isa',
    badge: 'Tax-free',
  },
  {
    key: 'fixed',
    icon: Lock,
    color: 'bg-amber-50 text-amber-700',
    border: 'border-amber-200',
    title: 'Fixed Deposit',
    subtitle: 'Guaranteed returns, locked rate',
    description: 'Lock in a guaranteed interest rate for 3, 6, 12 or 24 months. Perfect for capital you won\'t need short-term.',
    features: ['Guaranteed fixed rate', 'Terms from 3â€“24 months', 'FSCS protected up to $85k', 'Min. deposit $1,000'],
    rate: '5.20%',
    rateLabel: 'AER (12 months)',
    cta: 'Open Fixed Deposit',
    path: '/fixed-deposit',
    badge: 'Guaranteed rate',
  },
];

export default function WealthHubPage() {
  const navigate = useNavigate();

  return (
    <div>
      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-800 to-emerald-600 rounded-2xl p-8 mb-8 text-white">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={20} className="text-emerald-300" />
          <span className="text-emerald-300 text-sm font-medium">Oakstones 1 Bank â€” Wealth Hub</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">Grow your wealth</h1>
        <p className="text-emerald-100 text-lg max-w-xl">
          From tax-free savings to retirement planning and investment portfolios â€” everything you need to build lasting financial security.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-4 max-w-sm">
          {[
            { label: 'Products', value: '4' },
            { label: 'Min. to start', value: '$50' },
            { label: 'Protected up to', value: '$85k' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-emerald-300 text-xs">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Products grid */}
      <div className="grid grid-cols-2 gap-6">
        {PRODUCTS.map(p => {
          const Icon = p.icon;
          return (
            <div key={p.key} className={`card p-6 border ${p.border} hover:shadow-md transition-shadow`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${p.color}`}>
                  <Icon size={20} />
                </div>
                <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{p.badge}</span>
              </div>
              <h3 className="font-bold text-gray-900 text-lg">{p.title}</h3>
              <p className="text-xs text-gray-400 mb-2">{p.subtitle}</p>
              {p.rate && (
                <div className="mb-3">
                  <span className="text-2xl font-bold text-emerald-700">{p.rate}</span>
                  <span className="text-xs text-gray-400 ml-1">{p.rateLabel}</span>
                </div>
              )}
              <p className="text-sm text-gray-500 mb-4">{p.description}</p>
              <ul className="space-y-1 mb-5">
                {p.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate(p.path)}
                className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                {p.cta} <ArrowRight size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 mt-6 text-center">
        Capital at risk. The value of investments can go down as well as up. FSCS protection applies to eligible deposits only.
        Oakstones 1 Bank is a prototype â€” not a regulated financial institution.
      </p>
    </div>
  );
}