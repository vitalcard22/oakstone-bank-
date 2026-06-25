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
    mutationFn: (payload: any) => (txApi as any)[tab](payload),
    onSuccess: (res: any) => {
      const status = res?.data?.status;
      if (status === 'pending') {
        toast.success(tab === 'ach'
          ? 'ACH transfer initiated. Funds will settle in 1-3 business days.'
          : 'Wire transfer submitted and is pending review.');
      } else {
        toast.success('Transfer completed successfully');
      }
      reset();
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Transfer failed'),
  });

  // Build the exact request body the backend expects for each transfer type.
  const onSubmit = (d: any) => {
    let payload: any;
    if (tab === 'transfer') {
      payload = {
        fromAccountId: d.fromAccountId,
        toAccountId:   d.toAccountId,
        amount:        d.amount,
        description:   d.description || undefined,
      };
    } else if (tab === 'zelle') {
      payload = {
        fromAccountId: d.fromAccountId,
        identifier:    d.identifier,
        amount:        d.amount,
        note:          d.note || undefined,
      };
    } else if (tab === 'ach') {
      payload = {
        fromAccountId:         d.fromAccountId,
        routingNumber:         d.routingNumber,
        externalAccountNumber: d.externalAccountNumber,
        accountType:           d.accountType,
        direction:             d.direction, // 'debit' = send out, 'credit' = receive
        amount:                d.amount,
      };
    } else { // wire
      payload = {
        fromAccountId: d.fromAccountId,
        amount:        d.amount,
        recipient: {
          name:          d.recipientName,
          bankName:      d.recipientBank,
          accountNumber: d.recipientAccount,
          routingOrSwift: d.recipientRoutingSwift || undefined,
          memo:          d.wireMemo || undefined,
        },
      };
    }
    mut.mutate(payload);
  };

  const err = (k: string) =>
    errors[k] ? <p className="text-red-500 text-xs mt-1">{errors[k]?.message as string}</p> : null;

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
          {err('fromAccountId')}
        </div>

        {/* ---------- INTERNAL ---------- */}
        {tab === 'transfer' && (<>
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
            {err('toAccountId')}
          </div>
          <div>
            <label className="label">Memo (optional)</label>
            <input {...register('description')} className="input" placeholder="What is this for?" />
          </div>
        </>)}

        {/* ---------- ZELLE ---------- */}
        {tab === 'zelle' && (<>
          <div>
            <label className="label">Recipient email or phone</label>
            <input {...register('identifier', { required: 'Required' })} className="input" placeholder="email@example.com or +1..." />
            {err('identifier')}
            <p className="text-xs text-gray-400 mt-1">Recipient must have an active Oakstone account.</p>
          </div>
          <div>
            <label className="label">Note (optional)</label>
            <input {...register('note')} className="input" placeholder="Coffee, rent, etc." />
          </div>
        </>)}

        {/* ---------- ACH ---------- */}
        {tab === 'ach' && (<>
          <div>
            <label className="label">Direction</label>
            <select {...register('direction', { required: 'Required' })} className="input">
              <option value="">Select</option>
              <option value="debit">Send to external account (withdraw)</option>
              <option value="credit">Receive from external account (deposit)</option>
            </select>
            {err('direction')}
          </div>
          <div>
            <label className="label">Routing number</label>
            <input
              {...register('routingNumber', {
                required: 'Required',
                pattern: { value: /^\d{9}$/, message: 'Must be exactly 9 digits' },
              })}
              className="input" placeholder="9-digit routing number" maxLength={9} inputMode="numeric" />
            {err('routingNumber')}
          </div>
          <div>
            <label className="label">External account number</label>
            <input {...register('externalAccountNumber', { required: 'Required', minLength: { value: 4, message: 'Enter a valid account number' } })} className="input" placeholder="Account number" />
            {err('externalAccountNumber')}
          </div>
          <div>
            <label className="label">Account type</label>
            <select {...register('accountType', { required: 'Required' })} className="input">
              <option value="">Select</option>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
            </select>
            {err('accountType')}
          </div>
          <p className="text-xs text-gray-400">ACH transfers settle in 1-3 business days.</p>
        </>)}

        {/* ---------- WIRE ---------- */}
        {tab === 'wire' && (<>
          <div>
            <label className="label">Recipient name</label>
            <input {...register('recipientName', { required: 'Required' })} className="input" placeholder="Full name on the receiving account" />
            {err('recipientName')}
          </div>
          <div>
            <label className="label">Recipient bank name</label>
            <input {...register('recipientBank', { required: 'Required' })} className="input" placeholder="e.g. Chase Bank" />
            {err('recipientBank')}
          </div>
          <div>
            <label className="label">Recipient account number / IBAN</label>
            <input {...register('recipientAccount', { required: 'Required' })} className="input" placeholder="Account number or IBAN" />
            {err('recipientAccount')}
          </div>
          <div>
            <label className="label">Routing number or SWIFT/BIC (optional)</label>
            <input {...register('recipientRoutingSwift')} className="input" placeholder="ABA routing or SWIFT code" />
          </div>
          <div>
            <label className="label">Memo (optional)</label>
            <input {...register('wireMemo')} className="input" placeholder="Reason for transfer" />
          </div>
          <p className="text-xs text-gray-400">Wires are reviewed before being sent and show as pending until processed.</p>
        </>)}

        {/* Amount — all tabs */}
        <div>
          <label className="label">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input
              {...register('amount', {
                required: 'Required',
                min: { value: tab === 'wire' ? 100 : 0.01, message: tab === 'wire' ? 'Minimum $100 for wire' : 'Minimum $0.01' },
              })}
              type="number" step="0.01" placeholder="0.00" className="input pl-7" />
          </div>
          {err('amount')}
        </div>

        <button
          onClick={handleSubmit(onSubmit)}
          disabled={mut.isPending}
          className="btn-primary w-full py-3"
        >
          {mut.isPending ? 'Processing...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
