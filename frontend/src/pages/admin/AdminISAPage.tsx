import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import toast from 'react-hot-toast';
import { useState } from 'react';

const fmt = (n: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));

export default function AdminISAPage() {
  const qc = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const { data: items } = useQuery({ queryKey: ['admin-isa'], queryFn: () => adminApi.isaEnrollments().then(r => r.data) });

  const approveMut = useMutation({ mutationFn: (id: string) => adminApi.approveIsa(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-isa'] }); toast.success('Approved'); }, onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed') });
  const rejectMut = useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => adminApi.rejectIsa(id, reason), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-isa'] }); toast.success('Rejected'); setRejectingId(null); setReason(''); }, onError: () => toast.error('Failed') });

  const badge = (s: string) => s === 'pending' ? 'badge-amber' : s === 'active' ? 'badge-green' : s === 'rejected' ? 'badge-red' : 'badge-blue';

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Roth IRA enrollments</h1>
      {items?.map((p: any) => (
        <div key={p.id} className="card p-5">
          <div className="flex justify-between items-start mb-2 gap-3">
            <div className="min-w-0"><p className="font-semibold text-gray-900">{p.user_name || p.email}</p><p className="text-xs text-gray-400 truncate">{p.account_number ? `••••${String(p.account_number).slice(-4)}` : 'no account'}{p.status === 'active' && ` · balance ${fmt(p.balance)}`}</p></div>
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
      {!items?.length && <div className="text-center py-12 text-gray-400"><p className="text-sm">No Roth IRA enrollments</p></div>}
    </div>
  );
}
