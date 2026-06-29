import { useQuery } from '@tanstack/react-query';
import { authApi } from '../../services/api';
import { ShieldCheck, ShieldAlert, Mail, BadgeCheck, KeyRound, Monitor } from 'lucide-react';

// Parse a rough "Browser on OS" label from a user-agent string (best-effort, real data).
function deviceLabel(ua?: string): string {
  if (!ua) return 'Unknown device';
  const os = /Windows/i.test(ua) ? 'Windows'
    : /iPhone|iPad|iOS/i.test(ua) ? 'iOS'
    : /Android/i.test(ua) ? 'Android'
    : /Mac OS X|Macintosh/i.test(ua) ? 'macOS'
    : /Linux/i.test(ua) ? 'Linux' : 'Unknown OS';
  const browser = /Edg/i.test(ua) ? 'Edge'
    : /Chrome/i.test(ua) ? 'Chrome'
    : /Firefox/i.test(ua) ? 'Firefox'
    : /Safari/i.test(ua) ? 'Safari' : 'Browser';
  return `${browser} on ${os}`;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function SecurityPage() {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => authApi.getMe().then(r => r.data) });
  const { data: history } = useQuery({ queryKey: ['login-history'], queryFn: () => authApi.loginHistory().then(r => r.data) });

  const kyc = me?.kyc_status as string | undefined;
  const kycLabel = kyc === 'approved' ? 'Verified'
    : kyc === 'under_review' ? 'Under review'
    : kyc === 'rejected' ? 'Rejected' : 'Pending';
  const kycOk = kyc === 'approved';

  const items = [
    { icon: ShieldCheck, label: 'Two-step verification', value: 'On', sub: 'A one-time code is emailed to you at every sign-in.', ok: true },
    { icon: KeyRound,    label: 'Authenticator app', value: me?.mfa_enabled ? 'On' : 'Off', sub: me?.mfa_enabled ? 'Time-based codes are enabled.' : 'Optional extra layer using an authenticator app.', ok: !!me?.mfa_enabled },
    { icon: Mail,        label: 'Email verified', value: me?.email_verified ? 'Verified' : 'Not verified', sub: me?.email ?? '', ok: !!me?.email_verified },
    { icon: BadgeCheck,  label: 'Identity verification (KYC)', value: kycLabel, sub: 'Required to unlock full account features.', ok: kycOk },
    { icon: me?.is_active === false ? ShieldAlert : ShieldCheck, label: 'Account status', value: me?.is_active === false ? 'Restricted' : 'Active', sub: me?.is_active === false ? 'Contact support to restore full access.' : 'Your account is in good standing.', ok: me?.is_active !== false },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Security</h1>
        <p className="text-sm text-gray-400">Your sign-in protections and recent account access.</p>
      </div>

      {/* Real security status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div key={it.label} className="card p-5 flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${it.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 text-sm">{it.label}</p>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${it.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{it.value}</span>
                </div>
                {it.sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{it.sub}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Real login history */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Monitor size={16} className="text-gray-400" />
          <h2 className="font-semibold text-gray-900">Recent sign-ins</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">The most recent times your account was accessed.</p>

        {(!history || history.length === 0) ? (
          <p className="text-sm text-gray-400 text-center py-8">No sign-in activity recorded yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map((h: any, i: number) => (
              <div key={h.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {deviceLabel(h.user_agent)}
                    {i === 0 && <span className="ml-2 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Most recent</span>}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{when(h.created_at)}{h.ip ? ` · ${h.ip}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-4">If you don't recognize a sign-in, change your password and contact us. Oakstones 1 Bank will never ask you to share a code.</p>
      </div>
    </div>
  );
}
