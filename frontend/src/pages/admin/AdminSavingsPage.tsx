import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import toast from 'react-hot-toast';
import { useState } from 'react';

const fmt = (n: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));

export default function AdminSavingsPage() {
  const qc = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const { data: items } = useQuery({ queryKey: ['admin-savings-w'], queryFn: () => adminApi.savingsWithdrawals().then(r => r.data) });

  const approveMut = useMutation({ mutationFn: (id: string) => adminApi.approveSavingsWithdrawal(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-savings-w'] }); toast.success('Withdrawal approved and paid'); }, onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed') });
  const rejectMut = useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => adminApi.rejectSavingsWithdrawal(id, reason), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-savings-w'] }); toast.success('Rejected'); setRejectingId(null); setReason(''); }, onError: () => toast.error('Failed') });

  const badge = (s: string) => s === 'pending' ? 'badge-amber' : s === 'approved' ? 'badge-green' : s === 'rejected' ? 'badge-red' : 'badge-blue';

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Savings withdrawal requests</h1>
      {items?.map((w: any) => (
        <div key={w.id} className="card p-5">
          <div className="flex justify-between items-start mb-2 gap-3">
            <div className="min-w-0"><p className="font-semibold text-gray-900">{w.user_name || w.email}</p><p className="text-xs text-gray-400 truncate">{fmt(w.amount)} from "{w.goal_name || 'goal'}" → ••••{String(w.account_number || '').slice(-4)}</p></div>
            <span className={badge(w.status)}>{w.status}</span>
          </div>
          {w.status === 'rejected' && w.reject_reason && <p className="text-sm text-gray-500 italic mb-2">"{w.reject_reason}"</p>}
          {w.status === 'pending' && rejectingId !== w.id && (
            <div className="flex gap-2 mt-3">
              <button onClick={() => approveMut.mutate(w.id)} disabled={approveMut.isPending} className="btn-primary text-xs py-1.5 px-4 bg-green-600 hover:bg-green-700">{approveMut.isPending ? 'Paying…' : 'Approve & pay'}</button>
              <button onClick={() => setRejectingId(w.id)} className="btn-danger text-xs py-1.5 px-4">Reject</button>
            </div>
          )}
          {rejectingId === w.id && (
            <div className="flex flex-wrap gap-2 mt-3 items-center">
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for rejection" className="input flex-1 min-w-[200px] text-sm py-1.5" />
              <button onClick={() => rejectMut.mutate({ id: w.id, reason: reason || 'Not approved' })} className="btn-danger text-xs py-1.5 px-4">Confirm reject</button>
              <button onClick={() => { setRejectingId(null); setReason(''); }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          )}
        </div>
      ))}
      {!items?.length && <div className="text-center py-12 text-gray-400"><p className="text-sm">No savings withdrawal requests</p></div>}
    </div>
  );
}
