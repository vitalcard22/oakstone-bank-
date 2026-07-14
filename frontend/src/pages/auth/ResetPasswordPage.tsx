import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../services/api';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (newPassword !== confirm) { toast.error('Passwords do not match'); return; }
    setBusy(true);
    try {
      await authApi.resetPassword({ token, newPassword });
      toast.success('Password reset successful. Please sign in.');
      navigate('/login');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Reset link expired or invalid');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          {!token ? (
            <div className="text-center">
              <p className="font-semibold text-gray-900 mb-2">Invalid link</p>
              <p className="text-sm text-gray-500 mb-4">This reset link is missing its token. Please request a new one.</p>
              <Link to="/forgot-password" className="text-navy-600 text-sm hover:underline">Request new link</Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Choose a new password</h2>
              <p className="text-sm text-gray-500 mb-4">Reset links expire after 1 hour.</p>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="label">New password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div>
                  <label className="label">Confirm new password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="input"
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <button type="submit" disabled={busy} className="btn-primary w-full py-3 disabled:opacity-60">
                  {busy ? 'Resetting…' : 'Reset password'}
                </button>
              </form>
              <div className="mt-4 text-center">
                <Link to="/login" className="text-xs text-gray-400 hover:underline">Back to sign in</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
