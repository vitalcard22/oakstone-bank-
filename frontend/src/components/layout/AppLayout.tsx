import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { authApi } from '../../services/api';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, Wallet, ArrowLeftRight, Zap,
  CreditCard, Landmark, Bell, User, LogOut, Shield,
} from 'lucide-react';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/accounts', label: 'Accounts', Icon: Wallet },
  { to: '/transfer', label: 'Transfer', Icon: ArrowLeftRight },
  { to: '/zelle', label: 'Send money', Icon: Zap },
  { to: '/cards', label: 'Cards', Icon: CreditCard },
  { to: '/loans', label: 'Loans', Icon: Landmark },
  { to: '/notifications', label: 'Notifications', Icon: Bell },
  { to: '/profile', label: 'Profile', Icon: User },
];

export default function AppLayout() {
  const { user, logout, isAdmin } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogout() {
    try { await authApi.logout(); } catch { /* ignore */ }
    logout();
    navigate('/');
    toast.success('Signed out');
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 bg-navy-600 flex flex-col flex-shrink-0">
        <div className="px-5 py-5 border-b border-white/10">
          {/* Clickable brand -> public homepage */}
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Oakstone 1 Bank" className="w-8 h-8 object-contain flex-shrink-0" />
            <div>
              <p className="text-white font-semibold text-sm leading-tight">Oakstone 1 Bank</p>
              <p className="text-gold-400 text-xs">Member FDIC</p>
            </div>
          </Link>
        </div>

        <div className="px-3 py-3 border-b border-white/10">
          <div className="bg-white/5 rounded-md px-3 py-2">
            <p className="text-white text-xs font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-white/50 text-xs truncate">{user?.email}</p>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive ? 'bg-white/10 text-white' : 'text-white/65 hover:text-white hover:bg-white/5'
              }`
            }>
              <Icon size={15} className="flex-shrink-0" />
              {label}
            </NavLink>
          ))}

          {isAdmin() && (
            <>
              <div className="my-2 border-t border-white/10" />
              <NavLink to="/admin/dashboard" className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? 'bg-white/10 text-white' : 'text-white/65 hover:text-white hover:bg-white/5'
                }`
              }>
                <Shield size={15} className="flex-shrink-0" />
                Admin panel
              </NavLink>
            </>
          )}
        </nav>

        <div className="p-2 border-t border-white/10">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
