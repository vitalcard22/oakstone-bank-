import { ShieldCheck, Smartphone, Key, AlertTriangle, CheckCircle, Globe } from 'lucide-react';

const SESSIONS = [
  { device: 'Chrome on Windows 11', location: 'Lagos, Nigeria', time: 'Active now', current: true },
  { device: 'Safari on iPhone', location: 'Lagos, Nigeria', time: '2 hours ago', current: false },
  { device: 'Chrome on Windows 11', location: 'Abuja, Nigeria', time: 'Yesterday 4:32 PM', current: false },
];


export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Security Center</h1>
        <p className="text-sm text-gray-400">Manage your account security and review activity</p>
      </div>

      {/* Security score */}
      <div className="bg-gradient-to-br from-emerald-800 to-emerald-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-300 text-sm mb-1">Security score</p>
            <p className="text-4xl font-bold mb-2">85 / 100</p>
            <p className="text-emerald-200 text-sm">Your account is well protected</p>
          </div>
          <div className="w-24 h-24 rounded-full border-4 border-emerald-400 flex items-center justify-center">
            <ShieldCheck size={40} className="text-emerald-300" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: '2FA enabled', done: true },
            { label: 'Email verified', done: true },
            { label: 'Strong password', done: true },
            { label: 'Recovery email', done: false },
            { label: 'Trusted devices', done: false },
            { label: 'Biometric login', done: false },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              {s.done
                ? <CheckCircle size={14} className="text-emerald-300" />
                : <AlertTriangle size={14} className="text-amber-400" />
              }
              <span className={`text-xs ${s.done ? 'text-emerald-200' : 'text-amber-300'}`}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Security settings */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Security settings</h2>
            <div className="space-y-4">
              {[
                { icon: Smartphone, label: 'Two-factor authentication', sub: 'Email code required at login', enabled: true },
                { icon: Key, label: 'Password', sub: 'Last changed 30 days ago', enabled: null },
                { icon: Globe, label: 'Trusted locations', sub: 'Lagos, Nigeria', enabled: true },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
                      <s.icon size={16} className="text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.label}</p>
                      <p className="text-xs text-gray-400">{s.sub}</p>
                    </div>
                  </div>
                  {s.enabled === null
                    ? <button className="text-xs text-emerald-700 font-medium hover:underline">Change</button>
                    : <div className={`w-9 h-5 rounded-full transition-colors relative ${s.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${s.enabled ? 'left-4' : 'left-0.5'}`} />
                      </div>
                  }
                </div>
              ))}
            </div>
          </div>

          {/* Active sessions */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Active sessions</h2>
            <div className="space-y-3">
              {SESSIONS.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{s.device}</p>
                      {s.current && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Current</span>}
                    </div>
                    <p className="text-xs text-gray-400">{s.location} · {s.time}</p>
                  </div>
                  {!s.current && (
                    <button className="text-xs text-red-500 hover:text-red-600 font-medium">Revoke</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}