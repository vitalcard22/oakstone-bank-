import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../../services/api';
import { useAuthStore, normalizeUser } from '../../stores/auth.store';
import toast from 'react-hot-toast';

export default function MfaPage() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { setUser, setAccessToken } = useAuthStore();
  const { register, handleSubmit } = useForm<{ token: string }>();
  const challengeToken = (location.state as any)?.challengeToken;

  async function onSubmit({ token }: { token: string }) {
    try {
      const res = await authApi.completeMfa({ challengeToken, token });
      setAccessToken(res.data.accessToken);
      const me = await authApi.getMe();
      setUser(normalizeUser(me.data));
      navigate(me.data.role === 'customer' ? '/dashboard' : '/admin/dashboard');
    } catch {
      toast.error('Invalid MFA code');
    }
  }

  return (
    <div className="min-h-screen bg-navy-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Two-factor authentication</h2>
          <p className="text-sm text-gray-400 mb-6">Enter the 6-digit code from your authenticator app</p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <input {...register('token')} type="text" inputMode="numeric" maxLength={6}
              placeholder="000000" className="input text-center text-2xl font-mono tracking-widest" autoFocus/>
            <button type="submit" className="btn-primary w-full py-3">Verify</button>
          </form>
        </div>
      </div>
    </div>
  );
}