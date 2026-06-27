import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import toast from 'react-hot-toast';
import { useState } from 'react';

const fmt = (n: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export default function AdminFixedDepositsPage() {
  const qc = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const { data: items } = useQuery({ queryKey: ['admin-fixed-deposits'], queryFn: () => adminApi.fixedDeposits().then(r => r.data) });

  const approveMut = useMutation({
    mutationFn: (id: string) => adminApi.approveFixedDeposit(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-fixed-deposits'] }); toast.success('Approved and funded'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const payoutMut = useMutation({
    mutationFn: (id: string) => adminApi.payoutFixedDeposit(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-fixed-deposits'] }); toast.success('Paid out — funds returned to customer'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminApi.rejectFixedDeposit(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-fixed-deposits'] }); toast.success('Rejected'); setRejectingId(null); setReason(''); },
    onError: () => toast.error('Failed'),
  });

  const badge = (s: string) =>
    s === 'pending' ? 'badge-amber' : s === 'active' ? 'badge-green' : s === 'rejected' ? 'badge-red' : 'badge-blue';

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Fixed deposit applications</h1>

      {items?.map((d: any) => (
        <div key={d.id} className="card p-5">
          <div className="flex justify-between items-start mb-2 gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">{fmt(d.principal)} · {d.term_months} months @ {Number(d.interest_rate).toFixed(2)}%</p>
              <p className="text-xs text-gray-400 truncate">
                {d.user_name || d.email} · ••••{String(d.account_number).slice(-4)}
                {d.status === 'active' && ` · matures ${fmtDate(d.maturity_date)} → ${fmt(d.maturity_value)}`}
              </p>
            </div>
            <span className={badge(d.status)}>{d.status}</span>
          </div>

          {d.status === 'rejected' && d.reject_reason && (
            <p className="text-sm text-gray-500 italic mb-2">"{d.reject_reason}"</p>
          )}

          {d.status === 'active' && (
            <div className="flex gap-2 mt-3">
              <button onClick={() => payoutMut.mutate(d.id)} disabled={payoutMut.isPending}
                className="btn-primary text-xs py-1.5 px-4 bg-amber-600 hover:bg-amber-700">
                {payoutMut.isPending ? 'Paying out…' : 'Pay out (mature)'}
              </button>
            </div>
          )}

          {d.status === 'pending' && rejectingId !== d.id && (
            <div className="flex gap-2 mt-3">
              <button onClick={() => approveMut.mutate(d.id)} disabled={approveMut.isPending}
                className="btn-primary text-xs py-1.5 px-4 bg-green-600 hover:bg-green-700">
                {approveMut.isPending ? 'Approving…' : 'Approve & fund'}
              </button>
              <button onClick={() => setRejectingId(d.id)} className="btn-danger text-xs py-1.5 px-4">Reject</button>
            </div>
          )}

          {rejectingId === d.id && (
            <div className="flex flex-wrap gap-2 mt-3 items-center">
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for rejection"
                className="input flex-1 min-w-[200px] text-sm py-1.5" />
              <button onClick={() => rejectMut.mutate({ id: d.id, reason: reason || 'Not approved' })}
                className="btn-danger text-xs py-1.5 px-4">Confirm reject</button>
              <button onClick={() => { setRejectingId(null); setReason(''); }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          )}
        </div>
      ))}

      {!items?.length && (
        <div className="text-center py-12 text-gray-400"><p className="text-sm">No fixed deposit applications</p></div>
      )}
    </div>
  );
}
