import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { txApi } from '../../services/api';

const TYPE_TITLE: Record<string, string> = {
  transfer: 'Internal transfer',
  zelle:    'Zelle payment',
  ach:      'ACH transfer',
  wire:     'Wire transfer',
  fee:      'Fee',
  deposit:  'Deposit',
  withdrawal: 'Withdrawal',
  payment:  'Payment',
};

const DIRECTION_LABEL: Record<string, string> = {
  debit:  'Send to external account (withdraw)',
  credit: 'Receive from external account (deposit)',
};

const money = (n: any) =>
  `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const mask = (s?: string) => (s ? `â€¢â€¢â€¢â€¢${String(s).slice(-4)}` : 'â€”');

function parseMeta(m: any) {
  if (!m) return {};
  if (typeof m === 'string') { try { return JSON.parse(m); } catch { return {}; } }
  return m;
}

export default function TransferReceiptPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: tx, isLoading, isError } = useQuery({
    queryKey: ['transaction', id],
    queryFn: () => txApi.get(id as string).then(r => r.data),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="py-20 text-center text-sm text-gray-400">Loading receiptâ€¦</div>;
  }
  if (isError || !tx) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-gray-500 mb-4">We couldn't find that transaction.</p>
        <button onClick={() => navigate('/transfer')} className="btn-primary px-5 py-2.5">Back to transfers</button>
      </div>
    );
  }

  const meta = parseMeta(tx.metadata);
  const type = tx.tx_type as string;
  const fee = Number(meta?.fee ?? 0);
  const amount = Number(tx.amount ?? 0);
  const total = amount + (type === 'wire' ? fee : 0);
  const when = tx.created_at ? new Date(tx.created_at).toLocaleString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : 'â€”';

  const isCompleted = String(tx.status).toLowerCase() === 'completed';

  // Recipient line varies by transfer type.
  const rows: Array<[string, any]> = [
    ['From account', tx.from_account_type ? `${tx.from_account_type} ${mask(tx.from_account_number)}` : mask(tx.from_account_number)],
  ];

  if (type === 'transfer') {
    rows.push(['To account', mask(tx.to_account_number)]);
    if (tx.description) rows.push(['Memo', tx.description]);
  } else if (type === 'zelle') {
    rows.push(['To account', mask(tx.to_account_number)]);
    if (tx.description) rows.push(['Note', tx.description]);
  } else if (type === 'ach') {
    rows.push(['Direction', DIRECTION_LABEL[meta?.direction] ?? meta?.direction ?? 'â€”']);
    if (meta?.accountHolderName) rows.push(['Account holder', meta.accountHolderName]);
    if (meta?.routingNumber) rows.push(['Routing number', meta.routingNumber]);
    if (meta?.externalAccountNumber) rows.push(['External account', mask(meta.externalAccountNumber)]);
    if (meta?.accountType) rows.push(['Account type', meta.accountType]);
  } else if (type === 'wire') {
    const r = meta?.recipient ?? {};
    if (r.name) rows.push(['Beneficiary', r.name]);
    if (r.bankName) rows.push(['Recipient bank', r.bankName]);
    if (r.accountNumber) rows.push(['Account / IBAN', mask(r.accountNumber)]);
    if (r.routingOrSwift) rows.push(['Routing / SWIFT', r.routingOrSwift]);
    if (r.intermediaryBank) rows.push(['Intermediary bank', r.intermediaryBank]);
    if (r.bankCountry) rows.push(['Bank country', r.bankCountry]);
    if (r.beneficiaryAddress) rows.push(['Beneficiary address', r.beneficiaryAddress]);
    if (r.memo) rows.push(['Purpose / memo', r.memo]);
  }

  return (
    <div className="max-w-xl mx-auto">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #receipt-printable, #receipt-printable * { visibility: visible !important; }
          #receipt-printable { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div id="receipt-printable" className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="bg-navy-700 text-white px-8 py-6 flex items-center justify-between" style={{ background: '#0f2547' }}>
          <div>
            <p className="text-xs uppercase tracking-widest opacity-70">Oakstones Bank</p>
            <p className="text-lg font-semibold mt-0.5">Transfer receipt</p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-70">Reference</p>
            <p className="font-mono text-sm">{tx.reference_id ?? tx.id}</p>
          </div>
        </div>

        {/* Status */}
        <div className="px-8 pt-8 pb-2 text-center">
          <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center ${isCompleted ? 'bg-green-100' : 'bg-amber-100'}`}>
            {isCompleted ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            )}
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mt-4">{TYPE_TITLE[type] ?? 'Transfer'} {isCompleted ? 'completed' : 'submitted'}</h1>
          <span className={`inline-block mt-2 text-xs font-medium px-3 py-1 rounded-full ${isCompleted ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            {String(tx.status).charAt(0).toUpperCase() + String(tx.status).slice(1)}
          </span>
          <p className="text-3xl font-semibold text-gray-900 mt-4">{money(amount)}</p>
          <p className="text-xs text-gray-400 mt-1">{when}</p>
        </div>

        {/* Details */}
        <div className="px-8 py-6">
          <div className="border border-gray-100 rounded-xl divide-y divide-gray-100">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-4 py-3">
                <span className="text-sm text-gray-500">{label}</span>
                <span className="text-sm text-gray-900 text-right font-medium break-all">{value}</span>
              </div>
            ))}
          </div>

          {/* Money summary */}
          <div className="bg-gray-50 rounded-xl p-4 mt-5 space-y-1">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Amount</span><span className="font-medium">{money(amount)}</span></div>
            {type === 'wire' && fee > 0 && (
              <div className="flex justify-between text-sm"><span className="text-gray-500">Wire fee</span><span className="font-medium">{money(fee)}</span></div>
            )}
            <div className="flex justify-between text-base pt-1 border-t border-gray-200 mt-1">
              <span className="font-semibold text-gray-900">Total {type === 'wire' && fee > 0 ? 'debited' : ''}</span>
              <span className="font-semibold text-gray-900">{money(total)}</span>
            </div>
          </div>

          <p className="text-[11px] text-gray-400 text-center mt-5">
            This receipt was generated by Oakstones Bank. Reference {tx.reference_id ?? tx.id}. Keep it for your records.
          </p>
        </div>
      </div>

      {/* Actions (not printed) */}
      <div className="flex gap-3 mt-6 no-print">
        <button onClick={() => window.print()} className="flex-1 py-3 rounded-md border border-gray-200 text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
          Download / print receipt
        </button>
        <button onClick={() => navigate('/transfer')} className="btn-primary flex-1 py-3">
          Done
        </button>
      </div>
    </div>
  );
}
