import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wealthApi, accountApi } from '../../services/api';
import toast from 'react-hot-toast';
import { Target, Plus, Trash2, CheckCircle } from 'lucide-react';

const fmt = (n: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;

const ICONS = ['🏠', '✈️', '🚗', '📚', '💍', '🏖️', '💻', '🎓', '🛡️', '🌍'];
const COLORS = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500'];

export default function SavingsGoalsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', icon: '🏠', color: 'bg-emerald-500', target: '', date: '', accountId: '' });
  const [moveFor, setMoveFor] = useState<string | null>(null);
  const [moveAmt, setMoveAmt] = useState('');

  const { data: goals = [], isLoading } = useQuery({ queryKey: ['savings-goals'], queryFn: () => wealthApi.savingsGoals().then(r => r.data) });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => accountApi.list().then(r => r.data) });

  const refresh = () => { qc.invalidateQueries({ queryKey: ['savings-goals'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); };

  const createMut = useMutation({
    mutationFn: () => wealthApi.createSavingsGoal({ name: form.name, icon: form.icon, color: form.color, targetAmount: Number(form.target), targetDate: form.date || null, accountId: form.accountId }),
    onSuccess: () => { refresh(); setShowForm(false); setForm({ name: '', icon: '🏠', color: 'bg-emerald-500', target: '', date: '', accountId: '' }); toast.success('Goal created'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Could not create goal'),
  });
  const contribMut = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => wealthApi.contributeSavingsGoal(id, amount),
    onSuccess: () => { refresh(); setMoveFor(null); setMoveAmt(''); toast.success('Added to goal'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });
  const withdrawMut = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => wealthApi.withdrawSavingsGoal(id, amount),
    onSuccess: () => { refresh(); setMoveFor(null); setMoveAmt(''); toast.success('Withdrawal request submitted for approval'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => wealthApi.deleteSavingsGoal(id),
    onSuccess: () => { refresh(); toast.success('Goal closed — funds returned'); },
    onError: () => toast.error('Failed'),
  });

  const totalSaved = goals.reduce((s: number, g: any) => s + Number(g.saved_amount), 0);
  const totalTarget = goals.reduce((s: number, g: any) => s + Number(g.target_amount), 0);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-700 to-emerald-500 rounded-2xl p-6 sm:p-8 text-white">
        <div className="flex items-center gap-2 mb-3"><Target size={18} className="text-emerald-200" /><span className="text-emerald-200 text-sm font-medium">Savings Goals</span></div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">{fmt(totalSaved)} <span className="text-emerald-200 text-lg font-normal">saved of {fmt(totalTarget)}</span></h1>
        <p className="text-emerald-100 text-sm">Set targets and move money aside for what matters.</p>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-900">Your goals</h2>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary text-sm py-1.5 px-4 flex items-center gap-1.5"><Plus size={15} />New goal</button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card p-5 space-y-3">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Goal name (e.g. House deposit)" className="input w-full" />
          <div className="flex gap-2 flex-wrap">
            {ICONS.map(ic => <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))} className={`w-9 h-9 rounded-lg text-lg ${form.icon === ic ? 'ring-2 ring-emerald-500 bg-emerald-50' : 'bg-gray-50'}`}>{ic}</button>)}
          </div>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} className={`w-7 h-7 rounded-full ${c} ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`} />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="number" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} placeholder="Target amount" className="input w-full" />
            <input type="month" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value ? e.target.value + '-01' : '' }))} className="input w-full" />
          </div>
          <select value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))} className="input w-full">
            <option value="">Linked account…</option>
            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.account_type} ••••{String(a.account_number).slice(-4)} — {fmt(a.available_balance)}</option>)}
          </select>
          <button onClick={() => { if (!form.name || !form.target || !form.accountId) { toast.error('Name, target and account are required'); return; } createMut.mutate(); }} disabled={createMut.isPending} className="btn-primary w-full">{createMut.isPending ? 'Creating…' : 'Create goal'}</button>
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
      {!isLoading && goals.length === 0 && !showForm && <div className="card p-8 text-center text-sm text-gray-400">No goals yet. Create your first one.</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {goals.map((g: any) => {
          const saved = Number(g.saved_amount), target = Number(g.target_amount);
          const pct = Math.min(100, Math.round((saved / target) * 100));
          const done = g.status === 'completed';
          return (
            <div key={g.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl ${g.color || 'bg-emerald-500'} flex items-center justify-center text-xl`}>{g.icon || '🎯'}</div>
                  <div>
                    <p className="font-semibold text-gray-900">{g.name}</p>
                    <p className="text-xs text-gray-400">{fmtDate(g.target_date) ? `Target ${fmtDate(g.target_date)} · ` : ''}••••{String(g.account_number).slice(-4)}</p>
                  </div>
                </div>
                {done
                  ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle size={12} />Reached</span>
                  : <button onClick={() => deleteMut.mutate(g.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>}
              </div>

              <div className="flex justify-between text-sm mb-1"><span className="font-semibold text-gray-900">{fmt(saved)}</span><span className="text-gray-400">of {fmt(target)}</span></div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3"><div className={`h-full ${g.color || 'bg-emerald-500'}`} style={{ width: `${pct}%` }} /></div>

              {moveFor === g.id ? (
                <div className="flex flex-wrap gap-2 items-center">
                  <input type="number" value={moveAmt} onChange={e => setMoveAmt(e.target.value)} placeholder="Amount" className="input flex-1 min-w-[120px] text-sm py-1.5" />
                  <button onClick={() => contribMut.mutate({ id: g.id, amount: Number(moveAmt) })} className="btn-primary text-xs py-1.5 px-3">Add</button>
                  <button onClick={() => withdrawMut.mutate({ id: g.id, amount: Number(moveAmt) })} className="text-xs py-1.5 px-3 border border-gray-200 rounded-lg hover:bg-gray-50">Request withdrawal</button>
                  <button onClick={() => { setMoveFor(null); setMoveAmt(''); }} className="text-xs text-gray-400">Cancel</button>
                </div>
              ) : (
                <button onClick={() => { setMoveFor(g.id); setMoveAmt(''); }} className="w-full text-sm text-emerald-700 hover:bg-emerald-50 rounded-lg py-1.5 font-medium">Add / withdraw money</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
