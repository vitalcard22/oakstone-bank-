import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { api, authApi } from '../../services/api';
import { useAuthStore, normalizeUser } from '../../stores/auth.store';
import toast from 'react-hot-toast';
import { useState } from 'react';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Required'),
});
type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser, setAccessToken } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(data: Form) {
    setLoading(true);
    try {
      // Use api directly with _skipAuth to avoid refresh interceptor on login failures
      const res = await api.post('/auth/login', data, { _skipAuth: true } as any);

      if (res.data.requiresCode) {
        navigate('/login-code', { state: { challengeToken: res.data.challengeToken, email: data.email } });
        return;
      }
      if (res.data.requiresMfa) {
        navigate('/mfa', { state: { challengeToken: res.data.challengeToken } });
        return;
      }
      setAccessToken(res.data.accessToken);
      const me = await authApi.getMe();
      setUser(normalizeUser(me.data));
      navigate(me.data.role === 'customer' ? '/dashboard' : '/admin/dashboard');
    } catch (e: any) {
      const msg = e.response?.data?.error || e.response?.data?.message || 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-4">
            <img src="/logo.png" alt="Oakstones 1 Bank" className="w-12 h-12 object-contain" />
            <span className="text-white text-2xl font-semibold">Oakstones 1 Bank</span>
          </Link>
          <p className="text-white/60 text-sm">Sign in to your account</p>
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input {...register('email')} type="email" className="input" placeholder="you@example.com" autoComplete="email"/>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="label mb-0">Password</label>
                <Link to="/forgot-password" className="text-xs text-gold-500 hover:underline">Forgot password?</Link>
              </div>
              <input {...register('password')} type="password" className="input" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" autoComplete="current-password"/>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-6">
            No account?{' '}
            <Link to="/register" className="text-navy-600 font-medium hover:underline">Open one today</Link>
          </p>
        </div>
        <p className="text-center text-white/40 text-xs mt-6">
          <Link to="/" className="hover:text-white/70">&larr; Back to home</Link>
        </p>
      </div>
    </div>
  );
}
