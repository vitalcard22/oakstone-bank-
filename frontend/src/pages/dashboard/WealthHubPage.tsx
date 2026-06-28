import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { wealthApi } from '../../services/api';
import { Lock, Target, PiggyBank, Landmark, TrendingUp, ChevronRight, Wallet, Plus } from 'lucide-react';

const fmt = (n: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));

const META: Record<string, { Icon: any; tint: string; ring: string }> = {
  fixed_deposit:   { Icon: Lock,       tint: 'bg-amber-50 text-amber-600',     ring: 'hover:border-amber-200' },
  savings_goals:   { Icon: Target,     tint: 'bg-emerald-50 text-emerald-600', ring: 'hover:border-emerald-200' },
  roth_ira:        { Icon: PiggyBank,  tint: 'bg-purple-50 text-purple-600',   ring: 'hover:border-purple-200' },
  retirement_401k: { Icon: Landmark,   tint: 'bg-blue-50 text-blue-600',       ring: 'hover:border-blue-200' },
  investment:      { Icon: TrendingUp, tint: 'bg-teal-50 text-teal-600',       ring: 'hover:border-teal-200' },
};

export default function WealthHubPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['wealth-hub'], queryFn: () => wealthApi.hub().then(r => r.data) });

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>;

  const products = data?.products ?? [];
  const total = data?.total ?? 0;
  const activeCount = products.filter((p: any) => p.started).length;

  return (
    <div className="space-y-6">
      {/* Total wealth */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-1">
          <Wallet size={16} className="text-gray-400" />
          <p className="text-sm text-gray-500">Total wealth across products</p>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2 break-words">{fmt(total)}</h1>
        <p className="text-sm text-gray-400">
          {activeCount > 0 ? `Across ${activeCount} active product${activeCount > 1 ? 's' : ''} · real balances only` : 'Start with any product below to grow your wealth'}
        </p>
      </div>

      {/* Product cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p: any) => {
          const m = META[p.key] ?? { Icon: Wallet, tint: 'bg-gray-50 text-gray-500', ring: 'hover:border-gray-300' };
          return (
            <button key={p.key} onClick={() => navigate(p.link)}
              className={`text-left bg-white border border-gray-200 rounded-2xl p-5 transition-colors ${m.ring} ${!p.started ? 'opacity-90' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${m.tint}`}><m.Icon size={18} /></div>
                <ChevronRight size={16} className="text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">{p.label}</p>
              {p.started ? (
                <p className="text-2xl font-bold text-gray-900 break-words">{fmt(p.value)}</p>
              ) : (
                <p className="text-2xl font-bold text-gray-300">{fmt(0)}</p>
              )}
              <p className={`text-xs mt-1 ${p.key === 'investment' && p.started && (p.gain ?? 0) >= 0 ? 'text-green-600' : 'text-gray-400'}`}>{p.status}</p>
            </button>
          );
        })}

        {/* Explore prompt */}
        <div className="border border-dashed border-gray-300 rounded-2xl p-5 flex flex-col justify-center bg-gray-50/50">
          <div className="flex items-center gap-2 mb-1"><Plus size={16} className="text-gray-400" /><p className="text-sm font-medium text-gray-500">Explore products</p></div>
          <p className="text-xs text-gray-400">Untouched products show $0 here — never estimated or fake balances.</p>
        </div>
      </div>
    </div>
  );
}
