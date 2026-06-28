import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import toast from 'react-hot-toast';
import { useState } from 'react';

export default function AdminInvestmentPage() {
  const qc = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [wRejectingId, setWRejectingId] = useState<string | null>(null);
  const [wReason, setWReason] = useState('');
  const { data: items } = useQuery({ queryKey: ['admin-investment'], queryFn: () => adminApi.investmentEnrollments().then(r => r.data) });
  const { data: sells } = useQuery({ queryKey: ['admin-investment-w'], queryFn: () => adminApi.investmentWithdrawals().then(r => r.data) });
  const wApproveMut = useMutation({ mutationFn: (id: string) => adminApi.approveInvestmentWithdrawal(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-investment-w'] }); toast.success('Sell executed and paid'); }, onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed') });
  const wRejectMut = useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => adminApi.rejectInvestmentWithdrawal(id, reason), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-investment-w'] }); toast.success('Rejected'); setWRejectingId(null); setWReason(''); }, onError: () => toast.error('Failed') });
  const fmt = (n: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));
  const rejectMut = useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => adminApi.rejectInvestment(id, reason), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-investment'] }); toast.success('Rejected'); setRejectingId(null); setReason(''); }, onError: () => toast.error('Failed') });

  const badge = (s: string) => s === 'pending' ? 'badge-amber' : s === 'active' ? 'badge-green' : s === 'rejected' ? 'badge-red' : 'badge-blue';

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Investment enrollments</h1>
      {items?.map((p: any) => (
        <div key={p.id} className="card p-5">
          <div className="flex justify-between items-start mb-2 gap-3">
            <div className="min-w-0"><p className="font-semibold text-gray-900">{p.user_name || p.email}</p><p className="text-xs text-gray-400 truncate">{p.account_number ? `••••${String(p.account_number).slice(-4)}` : 'no account'}</p></div>
            <span className={badge(p.status)}>{p.status}</span>
          </div>
          {p.status === 'rejected' && p.reject_reason && <p className="text-sm text-gray-500 italic mb-2">"{p.reject_reason}"</p>}
          {p.status === 'pending' && rejectingId !== p.id && (
            <div className="flex gap-2 mt-3">
              <button onClick={() => approveMut.mutate(p.id)} disabled={approveMut.isPending} className="btn-primary text-xs py-1.5 px-4 bg-green-600 hover:bg-green-700">{approveMut.isPending ? 'Approving…' : 'Approve'}</button>
              <button onClick={() => setRejectingId(p.id)} className="btn-danger text-xs py-1.5 px-4">Reject</button>
            </div>
          )}
          {rejectingId === p.id && (
            <div className="flex flex-wrap gap-2 mt-3 items-center">
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for rejection" className="input flex-1 min-w-[200px] text-sm py-1.5" />
              <button onClick={() => rejectMut.mutate({ id: p.id, reason: reason || 'Not approved' })} className="btn-danger text-xs py-1.5 px-4">Confirm reject</button>
              <button onClick={() => { setRejectingId(null); setReason(''); }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          )}
        </div>
      ))}
      {!items?.length && <div className="text-center py-8 text-gray-400"><p className="text-sm">No investment enrollments</p></div>}

      <h2 className="text-lg font-semibold text-gray-900 pt-4">Sell requests</h2>
      {sells?.map((w: any) => (
        <div key={w.id} className="card p-5">
          <div className="flex justify-between items-start mb-2 gap-3">
            <div className="min-w-0"><p className="font-semibold text-gray-900">{w.user_name || w.email}</p><p className="text-xs text-gray-400 truncate">Sell {w.shares} {w.symbol} · ~{fmt(w.est_proceeds)} at {fmt(w.est_price)}/sh → ••••{String(w.account_number || '').slice(-4)}</p></div>
            <span className={badge(w.status)}>{w.status}</span>
          </div>
          {w.status === 'rejected' && w.reject_reason && <p className="text-sm text-gray-500 italic mb-2">"{w.reject_reason}"</p>}
          {w.status === 'pending' && wRejectingId !== w.id && (
            <div className="flex gap-2 mt-3">
              <button onClick={() => wApproveMut.mutate(w.id)} disabled={wApproveMut.isPending} className="btn-primary text-xs py-1.5 px-4 bg-green-600 hover:bg-green-700">{wApproveMut.isPending ? 'Selling…' : 'Approve & sell at live price'}</button>
              <button onClick={() => setWRejectingId(w.id)} className="btn-danger text-xs py-1.5 px-4">Reject</button>
            </div>
          )}
          {wRejectingId === w.id && (
            <div className="flex flex-wrap gap-2 mt-3 items-center">
              <input value={wReason} onChange={e => setWReason(e.target.value)} placeholder="Reason for rejection" className="input flex-1 min-w-[200px] text-sm py-1.5" />
              <button onClick={() => wRejectMut.mutate({ id: w.id, reason: wReason || 'Not approved' })} className="btn-danger text-xs py-1.5 px-4">Confirm reject</button>
              <button onClick={() => { setWRejectingId(null); setWReason(''); }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          )}
        </div>
      ))}
      {!sells?.length && <div className="text-center py-8 text-gray-400"><p className="text-sm">No sell requests</p></div>}
    </div>
  );
}
