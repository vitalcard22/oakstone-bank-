import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountApi, txApi } from '../../services/api';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'transfer', label: 'Internal' },
  { key: 'zelle', label: 'Zelle' },
  { key: 'ach', label: 'ACH' },
  { key: 'wire', label: 'Wire' },
];

export default function TransferPage() {
  const [tab, setTab] = useState('transfer');
  const qc = useQueryClient();
  const { data: accounts } = useQuery({ queryKey: ['accounts'], queryFn: () => accountApi.list().then(r => r.data) });
  const active = accounts?.filter((a: any) => a.status === 'active') ?? [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>();

  const mut = useMutation({
    mutationFn: (d: any) => (txApi as any)[tab](d),
    onSuccess: () => {
      toast.success('Transfer submitted successfully');
      reset();
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Transfer failed'),
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Send Money</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); reset(); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card p-6 max-w-lg space-y-4">

        {/* From account — all tabs */}
        <div>
          <label className="label">From account</label>
          <select {...register('fromAccountId', { required: 'Required' })} className="input">
            <option value="">Select account</option>
            {active.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.account_type} ****{a.account_number?.slice(-4)} — ${parseFloat(a.available_balance ?? 0).toFixed(2)}
              </option>
            ))}
          </select>
          {errors.fromAccountId && <p className="text-red-500 text-xs mt-1">{errors.fromAccountId.message as string}</p>}
        </div>

        {/* Internal transfer */}
        {tab === 'transfer' && (
          <div>
            <label className="label">To account</label>
            <select {...register('toAccountId', { required: 'Required' })} className="input">
              <option value="">Select account</option>
              {active.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.account_type} ****{a.account_number?.slice(-4)}
                </option>
              ))}
            </select>
            {errors.toAccountId && <p className="text-red-500 text-xs mt-1">{errors.toAccountId.message as string}</p>}
          </div>
        )}

        {/* Zelle */}
        {tab === 'zelle' && (
          <div>
            <label className="label">Recipient email or phone</label>
            <input {...register('identifier', { required: 'Required' })} className="input" placeholder="email@example.com or +1..." />
            {errors.identifier && <p className="text-red-500 text-xs mt-1">{errors.identifier.message as string}</p>}
          </div>
        )}

        {/* ACH */}
        {tab === 'ach' && (<>
          <div>
            <label className="label">Routing number</label>
            <input {...register('routingNumber', { required: 'Required', minLength: { value: 9, message: 'Must be 9 digits' }, maxLength: { value: 9, message: 'Must be 9 digits' } })} className="input" placeholder="9-digit routing number" maxLength={9} />
            {errors.routingNumber && <p className="text-red-500 text-xs mt-1">{errors.routingNumber.message as string}</p>}
          </div>
          <div>
            <label className="label">External account number</label>
            <input {...register('externalAccountNumber', { required: 'Required' })} className="input" placeholder="Account number" />
            {errors.externalAccountNumber && <p className="text-red-500 text-xs mt-1">{errors.externalAccountNumber.message as string}</p>}
          </div>
          <div>
            <label className="label">Direction</label>
            <select {...register('direction', { required: 'Required' })} className="input">
              <option value="">Select</option>
              <option value="push">Push (send out)</option>
              <option value="pull">Pull (receive)</option>
            </select>
            {errors.direction && <p className="text-red-500 text-xs mt-1">{errors.direction.message as string}</p>}
          </div>
        </>)}

        {/* Wire */}
        {tab === 'wire' && (
          <div>
            <label className="label">Recipient details</label>
            <input {...register('recipient', { required: 'Required' })} className="input" placeholder="Recipient name or account" />
            {errors.recipient && <p className="text-red-500 text-xs mt-1">{errors.recipient.message as string}</p>}
          </div>
        )}

        {/* Amount — all tabs */}
        <div>
          <label className="label">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input {...register('amount', { required: 'Required', min: { value: tab === 'wire' ? 100 : 0.01, message: tab === 'wire' ? 'Minimum $100 for wire' : 'Minimum $0.01' } })} type="number" step="0.01" placeholder="0.00" className="input pl-7" />
          </div>
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message as string}</p>}
        </div>

        {/* Description — internal + zelle */}
        {(tab === 'transfer' || tab === 'zelle') && (
          <div>
            <label className="label">Description (optional)</label>
            <input {...register('description')} className="input" placeholder="What is this for?" />
          </div>
        )}

        <button
          onClick={handleSubmit(d => mut.mutate(d))}
          disabled={mut.isPending}
          className="btn-primary w-full py-3"
        >
          {mut.isPending ? 'Processing...' : 'Send'}
        </button>
      </div>
    </div>
  );
}