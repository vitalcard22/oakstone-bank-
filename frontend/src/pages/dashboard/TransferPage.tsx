import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const BLURB: Record<string, string> = {
  transfer: 'Send money to another Oakstones account by account number. Posts instantly.',
  zelle:    'Send money in minutes to anyone with an Oakstones account using their email or phone.',
  ach:      'Move money to or from an account at another US bank. Settles in 1-3 business days.',
  wire:     'Send a domestic or international wire. Reviewed before sending; minimum $100.',
};

const DIRECTION_LABEL: Record<string, string> = {
  debit:  'Send to external account (withdraw)',
  credit: 'Receive from external account (deposit)',
};

const money = (n: number) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function TransferPage() {
  const [tab, setTab] = useState('transfer');
  const [step, setStep] = useState<'form' | 'review' | 'code'>('form');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [review, setReview] = useState<any>(null);
  const [zelleName, setZelleName] = useState<string | null>(null);
  const [zelleNotFound, setZelleNotFound] = useState(false);

  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: accounts } = useQuery({ queryKey: ['accounts'], queryFn: () => accountApi.list().then(r => r.data) });
  const { data: cfg } = useQuery({ queryKey: ['tx-config'], queryFn: () => txApi.config().then(r => r.data) });
  const active = accounts?.filter((a: any) => a.status === 'active') ?? [];

  const fee   = cfg?.fees?.[tab] ?? 0;
  const limit = cfg?.limits?.[tab];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>();

  const switchTab = (key: string) => { setTab(key); setStep('form'); setReview(null); setZelleName(null); setZelleNotFound(false); setChallengeToken(null); setCode(''); reset(); };

  const mut = useMutation({
    mutationFn: (payload: any) => (txApi as any)[tab](payload),
    onSuccess: (res: any) => {
      if (res?.data?.requiresCode) {
        setChallengeToken(res.data.challengeToken);
        setCode('');
        setStep('code');
        toast.success('We emailed you a confirmation code');
        return;
      }
      qc.invalidateQueries({ queryKey: ['accounts'] });
      const txId = res?.data?.transactionId;
      setStep('form');
      setReview(null);
      setZelleName(null);
      setZelleNotFound(false);
      setChallengeToken(null);
      setCode('');
      reset();
      if (txId) {
        navigate(`/transfer/receipt/${txId}`);
      } else {
        toast.success('Transfer completed successfully');
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Transfer failed'),
  });

  const confirmMut = useMutation({
    mutationFn: (payload: any) => (txApi as any)[`${tab}Confirm`](payload),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['accounts'] });
      const txId = res?.data?.transactionId;
      setStep('form'); setReview(null); setZelleName(null); setZelleNotFound(false); setChallengeToken(null); setCode(''); reset();
      if (txId) navigate(`/transfer/receipt/${txId}`);
      else toast.success('Transfer completed successfully');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Incorrect or expired code'),
  });

  // Build the exact request body the backend expects for each transfer type.
  const buildPayload = (d: any) => {
    if (tab === 'transfer') {
      return {
        fromAccountId:   d.fromAccountId,
        toAccountNumber: d.toAccountNumber,
        recipientName:   d.recipientName || undefined,
        amount:          d.amount,
        description:     d.description || undefined,
      };
    }
    if (tab === 'zelle') {
      return {
        fromAccountId: d.fromAccountId,
        identifier:    d.identifier,
        amount:        d.amount,
        note:          d.note || undefined,
      };
    }
    if (tab === 'ach') {
      return {
        fromAccountId:         d.fromAccountId,
        accountHolderName:     d.accountHolderName,
        routingNumber:         d.routingNumber,
        externalAccountNumber: d.externalAccountNumber,
        accountType:           d.accountType,
        direction:             d.direction,
        amount:                d.amount,
      };
    }
    // wire
    return {
      fromAccountId: d.fromAccountId,
      amount:        d.amount,
      recipient: {
        name:               d.recipientName,
        accountNumber:      d.recipientAccount,
        bankName:           d.recipientBank,
        routingOrSwift:     d.recipientRoutingSwift || undefined,
        bankCountry:        d.bankCountry || undefined,
        beneficiaryStreet:  d.beneficiaryStreet || undefined,
        beneficiaryCity:    d.beneficiaryCity || undefined,
        beneficiaryState:   d.beneficiaryState || undefined,
        beneficiaryCountry: d.beneficiaryCountry || undefined,
        memo:               d.wireMemo || undefined,
      },
    };
  };

  // Validate → go to review (looking up the Zelle recipient name first).
  const onValid = async (d: any) => {
    if (tab === 'zelle') {
      setZelleName(null);
      setZelleNotFound(false);
      try {
        const res = await txApi.zelleLookup(d.identifier);
        if (res.data?.found) setZelleName(res.data.name || 'Oakstones customer');
        else setZelleNotFound(true);
      } catch {
        setZelleNotFound(true);
      }
    }
    setReview(d);
    setStep('review');
  };

  const err = (k: string) =>
    errors[k] ? <p className="text-red-500 text-xs mt-1">{errors[k]?.message as string}</p> : null;

  const fromAcct = active.find((a: any) => a.id === review?.fromAccountId);
  const fromLabel = fromAcct ? `${fromAcct.account_type} ****${fromAcct.account_number?.slice(-4)}` : review?.fromAccountId;
  const amt = parseFloat(review?.amount ?? 0) || 0;
  const total = amt + (fee || 0);

  const Row = ({ label, value }: { label: string; value: any }) =>
    value ? (
      <div className="flex justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
        <span className="text-sm text-gray-500">{label}</span>
        <span className="text-sm text-gray-900 text-right font-medium break-all">{value}</span>
      </div>
    ) : null;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Send Money</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-gray-500 mb-2 max-w-lg">{BLURB[tab]}</p>
      <p className="text-xs text-gray-400 mb-6 max-w-lg">
        {limit ? `Limit: ${money(limit)} per transfer. ` : ''}
        {fee > 0 ? `Fee: ${money(fee)}.` : 'No fee.'}
      </p>

      {/* ============ STEP 1: FORM ============ */}
      {step === 'form' && (
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

          {/* INTERNAL */}
          {tab === 'transfer' && (<>
            <div>
              <label className="label">Recipient account number</label>
              <input {...register('toAccountNumber', { required: 'Required', minLength: { value: 4, message: 'Enter a valid account number' } })} className="input" placeholder="Enter the recipient's Oakstones account number" inputMode="numeric" />
              {err('toAccountNumber')}
            </div>
            <div>
              <label className="label">Recipient name (optional)</label>
              <input {...register('recipientName')} className="input" placeholder="Name on the receiving account" />
            </div>
            <div>
              <label className="label">Memo (optional)</label>
              <input {...register('description')} className="input" placeholder="What is this for?" />
            </div>
          </>)}

          {/* ZELLE */}
          {tab === 'zelle' && (<>
            <div>
              <label className="label">Recipient email or phone</label>
              <input {...register('identifier', { required: 'Required' })} className="input" placeholder="email@example.com or +1..." />
              {err('identifier')}
              <p className="text-xs text-gray-400 mt-1">Recipient must have an active Oakstones account.</p>
            </div>
            <div>
              <label className="label">Note (optional)</label>
              <input {...register('note')} className="input" placeholder="Coffee, rent, etc." />
            </div>
          </>)}

          {/* ACH */}
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
              <label className="label">Account holder name</label>
              <input {...register('accountHolderName', { required: 'Required' })} className="input" placeholder="Name on the external account" />
              {err('accountHolderName')}
            </div>
            <div>
              <label className="label">Routing number</label>
              <input {...register('routingNumber', { required: 'Required', pattern: { value: /^\d{9}$/, message: 'Must be exactly 9 digits' } })} className="input" placeholder="9-digit ABA routing number" maxLength={9} inputMode="numeric" />
              {err('routingNumber')}
            </div>
            <div>
              <label className="label">Account number</label>
              <input {...register('externalAccountNumber', { required: 'Required', minLength: { value: 4, message: 'Enter a valid account number' } })} className="input" placeholder="External account number" inputMode="numeric" />
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
          </>)}

          {/* WIRE */}
          {tab === 'wire' && (<>
            <div>
              <label className="label">Recipient (beneficiary) name</label>
              <input {...register('recipientName', { required: 'Required' })} className="input" placeholder="Full name on the receiving account" />
              {err('recipientName')}
            </div>
            <div>
              <label className="label">Recipient account number / IBAN</label>
              <input {...register('recipientAccount', { required: 'Required' })} className="input" placeholder="Account number or IBAN" />
              {err('recipientAccount')}
            </div>
            <div>
              <label className="label">Recipient bank name</label>
              <input {...register('recipientBank', { required: 'Required' })} className="input" placeholder="e.g. Chase Bank" />
              {err('recipientBank')}
            </div>
            <div>
              <label className="label">Routing number (ABA) or SWIFT/BIC</label>
              <input {...register('recipientRoutingSwift')} className="input" placeholder="9-digit ABA for US, or SWIFT for international" />
            </div>
            <div>
              <label className="label">Recipient bank country (optional)</label>
              <input {...register('bankCountry')} className="input" placeholder="e.g. United States" />
            </div>
            <div>
              <label className="label">Beneficiary street address</label>
              <input {...register('beneficiaryStreet')} className="input" placeholder="Street address" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">City</label>
                <input {...register('beneficiaryCity')} className="input" placeholder="City" />
              </div>
              <div>
                <label className="label">State / Province</label>
                <input {...register('beneficiaryState')} className="input" placeholder="State / Province" />
              </div>
            </div>
            <div>
              <label className="label">Country</label>
              <input {...register('beneficiaryCountry')} className="input" placeholder="Country" />
            </div>
            <div>
              <label className="label">Purpose / memo (optional)</label>
              <input {...register('wireMemo')} className="input" placeholder="Reason for transfer" />
            </div>
          </>)}

          {/* Amount — all tabs */}
          <div>
            <label className="label">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input {...register('amount', { required: 'Required', min: { value: tab === 'wire' ? 100 : 0.01, message: tab === 'wire' ? 'Minimum $100 for wire' : 'Minimum $0.01' } })} type="number" step="0.01" placeholder="0.00" className="input pl-7" />
            </div>
            {err('amount')}
          </div>

          <button onClick={handleSubmit(onValid)} className="btn-primary w-full py-3">
            Review transfer
          </button>
        </div>
      )}

      {/* ============ STEP 2: REVIEW & CONFIRM ============ */}
      {step === 'review' && review && (
        <div className="card p-6 max-w-lg">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Review &amp; confirm</h2>
          <p className="text-xs text-gray-400 mb-4">Please check the details before sending. This cannot be undone.</p>

          <div className="mb-4">
            <Row label="From account" value={fromLabel} />

            {tab === 'transfer' && (<>
              <Row label="To account number" value={review.toAccountNumber} />
              <Row label="Recipient name" value={review.recipientName} />
              <Row label="Memo" value={review.description} />
            </>)}

            {tab === 'zelle' && (<>
              <Row label="Recipient" value={review.identifier} />
              <Row label="Recipient name" value={zelleName ?? undefined} />
              <Row label="Note" value={review.note} />
            </>)}

            {tab === 'ach' && (<>
              <Row label="Direction" value={DIRECTION_LABEL[review.direction] ?? review.direction} />
              <Row label="Account holder" value={review.accountHolderName} />
              <Row label="Routing number" value={review.routingNumber} />
              <Row label="Account number" value={review.externalAccountNumber} />
              <Row label="Account type" value={review.accountType} />
            </>)}

            {tab === 'wire' && (<>
              <Row label="Beneficiary" value={review.recipientName} />
              <Row label="Account / IBAN" value={review.recipientAccount} />
              <Row label="Bank" value={review.recipientBank} />
              <Row label="Routing / SWIFT" value={review.recipientRoutingSwift} />
              <Row label="Bank country" value={review.bankCountry} />
              <Row label="Beneficiary address" value={[review.beneficiaryStreet, review.beneficiaryCity, review.beneficiaryState, review.beneficiaryCountry].filter(Boolean).join(', ') || undefined} />
              <Row label="Purpose / memo" value={review.wireMemo} />
            </>)}
          </div>

          {tab === 'zelle' && zelleNotFound && (
            <div className="mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
              We couldn't find an Oakstones account for this recipient. If you continue, the transfer will be rejected unless they enroll.
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4 mb-5 space-y-1">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Amount</span><span className="font-medium">{money(amt)}</span></div>
            {fee > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Fee</span><span className="font-medium">{money(fee)}</span></div>}
            <div className="flex justify-between text-base pt-1 border-t border-gray-200 mt-1"><span className="font-semibold text-gray-900">Total</span><span className="font-semibold text-gray-900">{money(total)}</span></div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('form')} disabled={mut.isPending} className="flex-1 py-3 rounded-md border border-gray-200 text-sm font-medium hover:bg-gray-50">
              Back
            </button>
            <button onClick={() => mut.mutate(buildPayload(review))} disabled={mut.isPending} className="btn-primary flex-1 py-3">
              {mut.isPending ? 'Sending...' : 'Confirm & send'}
            </button>
          </div>
        </div>
      )}

      {step === 'code' && (
        <div className="card p-6 max-w-md mx-auto">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Confirm your transfer</h2>
          <p className="text-sm text-gray-500 mb-5">For your security, we emailed a 6-digit code to confirm this transfer. Enter it below to send.</p>
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            placeholder="······"
            className="input text-center text-2xl tracking-[0.5em] font-mono mb-1"
          />
          <p className="text-xs text-gray-400 mb-5">The code expires in 10 minutes.</p>
          <div className="flex gap-3">
            <button onClick={() => { setStep('review'); setCode(''); setChallengeToken(null); }} disabled={confirmMut.isPending} className="flex-1 py-3 rounded-md border border-gray-200 text-sm font-medium hover:bg-gray-50">
              Back
            </button>
            <button
              onClick={() => { if (code.length !== 6) { toast.error('Enter the 6-digit code'); return; } confirmMut.mutate({ challengeToken, code }); }}
              disabled={confirmMut.isPending || code.length !== 6}
              className="btn-primary flex-1 py-3 disabled:opacity-50"
            >
              {confirmMut.isPending ? 'Verifying...' : 'Verify & send'}
            </button>
          </div>
          <button onClick={() => mut.mutate(buildPayload(review))} disabled={mut.isPending} className="w-full mt-4 text-sm text-emerald-700 hover:underline">
            Didn't get it? Resend code
          </button>
        </div>
      )}
    </div>
  );
}
