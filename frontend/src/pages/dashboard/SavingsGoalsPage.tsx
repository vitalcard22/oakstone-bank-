import { useState } from 'react';
import { Target, Plus, Trash2, TrendingUp } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const ICONS = ['🏠', '✈️', '🚗', '📚', '💍', '🏖️', '💻', '🎓', '🏋️', '🌍'];
const COLORS = [
  'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500',
];

const DEFAULT_GOALS = [
  { id: 1, name: 'House deposit', icon: '🏠', color: 'bg-emerald-500', target: 50000, saved: 18500, monthly: 1000, deadline: '2027-12' },
  { id: 2, name: 'Dream vacation', icon: '✈️', color: 'bg-blue-500', target: 5000, saved: 3200, monthly: 300, deadline: '2026-08' },
  { id: 3, name: 'Emergency fund', icon: '🛡️', color: 'bg-amber-500', target: 10000, saved: 10000, monthly: 0, deadline: '2026-06' },
];

export default function SavingsGoalsPage() {
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', icon: '🏠', color: 'bg-emerald-500', target: '', saved: '', monthly: '', deadline: '' });

  const addGoal = () => {
    if (!form.name || !form.target) return;
    setGoals(g => [...g, {
      id: Date.now(),
      name: form.name,
      icon: form.icon,
      color: form.color,
      target: Number(form.target),
      saved: Number(form.saved) || 0,
      monthly: Number(form.monthly) || 0,
      deadline: form.deadline,
    }]);
    setForm({ name: '', icon: '🏠', color: 'bg-emerald-500', target: '', saved: '', monthly: '', deadline: '' });
    setShowForm(false);
  };

  const deleteGoal = (id: number) => setGoals(g => g.filter(x => x.id !== id));

  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Savings Goals</h1>
          <p className="text-sm text-gray-400">Track progress toward what matters most</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 btn-primary px-4 py-2 text-sm">
          <Plus size={16} /> New goal
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total saved', value: fmt(totalSaved), sub: `of ${fmt(totalTarget)} target` },
          { label: 'Active goals', value: goals.filter(g => g.saved < g.target).length, sub: `${goals.filter(g => g.saved >= g.target).length} completed` },
          { label: 'Monthly contributions', value: fmt(goals.reduce((s, g) => s + g.monthly, 0)), sub: 'across all goals' },
        ].map(s => (
          <div key={s.label} className="card p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Goals */}
      <div className="grid grid-cols-2 gap-4">
        {goals.map(g => {
          const pct = Math.min((g.saved / g.target) * 100, 100);
          const completed = g.saved >= g.target;
          const remaining = g.target - g.saved;
          const monthsLeft = g.monthly > 0 ? Math.ceil(remaining / g.monthly) : null;

          return (
            <div key={g.id} className={`card p-5 ${completed ? 'border-green-200 bg-green-50/30' : ''}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${g.color} rounded-xl flex items-center justify-center text-xl`}>
                    {g.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{g.name}</p>
                    {g.deadline && <p className="text-xs text-gray-400">Target: {g.deadline}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {completed && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Complete</span>}
                  <button onClick={() => deleteGoal(g.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-500">{fmt(g.saved)} saved</span>
                  <span className="font-semibold text-gray-900">{fmt(g.target)} goal</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${completed ? 'bg-green-500' : g.color}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{pct.toFixed(0)}% complete</span>
                  {!completed && <span>{fmt(remaining)} to go</span>}
                </div>
              </div>

              {!completed && g.monthly > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                  <TrendingUp size={12} className="text-emerald-500" />
                  <span>{fmt(g.monthly)}/mo · {monthsLeft ? `~${monthsLeft} months to goal` : 'on track'}</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Add goal card */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="card p-5 border-dashed border-2 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-emerald-600 min-h-40"
          >
            <Plus size={24} />
            <span className="text-sm font-medium">Add a new goal</span>
          </button>
        )}
      </div>

      {/* New goal form */}
      {showForm && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Create a new goal</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Goal name</label>
              <input className="input" placeholder="e.g. House deposit" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Target amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input className="input pl-7" type="number" placeholder="10000" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Already saved</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input className="input pl-7" type="number" placeholder="0" value={form.saved} onChange={e => setForm(f => ({ ...f, saved: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Monthly contribution</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input className="input pl-7" type="number" placeholder="200" value={form.monthly} onChange={e => setForm(f => ({ ...f, monthly: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Target date (optional)</label>
              <input className="input" type="month" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>
            <div>
              <label className="label">Icon</label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map(ic => (
                  <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))}
                    className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${form.icon === ic ? 'bg-emerald-100 ring-2 ring-emerald-500' : 'bg-gray-100 hover:bg-gray-200'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addGoal} className="btn-primary px-6 py-2.5 text-sm">Create goal</button>
            <button onClick={() => setShowForm(false)} className="px-6 py-2.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}