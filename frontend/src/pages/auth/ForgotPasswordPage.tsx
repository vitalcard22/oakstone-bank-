import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../services/api';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent]   = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try { await authApi.forgotPassword(email); setSent(true); }
    catch { toast.error('Something went wrong'); }
  }

  return (
    <div className="min-h-screen bg-navy-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          {sent ? (
            <div className="text-center">
              <p className="font-semibold text-gray-900 mb-2">Check your email</p>
              <p className="text-sm text-gray-500 mb-4">If that address exists, a reset link was sent.</p>
              <Link to="/login" className="text-navy-600 text-sm hover:underline">Back to sign in</Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Reset your password</h2>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="label">Email address</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@example.com" required/>
                </div>
                <button type="submit" className="btn-primary w-full py-3">Send reset link</button>
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