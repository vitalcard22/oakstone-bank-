import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { authApi } from '../../services/api';
import {
  LayoutDashboard, Wallet, ArrowLeftRight, Zap,
  CreditCard, Landmark, Bell, User, LogOut, Shield,
  TrendingUp, PiggyBank, Lock, Target, ShieldCheck, Moon, Sun,
} from 'lucide-react';
import { useState } from 'react';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/accounts', label: 'Accounts', Icon: Wallet },
  { to: '/transfer', label: 'Transfer', Icon: ArrowLeftRight },
  { to: '/zelle', label: 'Send money', Icon: Zap },
  { to: '/cards', label: 'Cards', Icon: CreditCard },
  { to: '/loans', label: 'Loans', Icon: Landmark },
  { to: '/notifications', label: 'Notifications', Icon: Bell },
];

const WEALTH_NAV = [
  { to: '/wealth', label: 'Wealth Hub', Icon: TrendingUp },
  { to: '/investment', label: 'Investment', Icon: TrendingUp },
  { to: '/pension', label: 'Pension (SIPP)', Icon: Landmark },
  { to: '/isa', label: 'ISA', Icon: PiggyBank },
  { to: '/fixed-deposit', label: 'Fixed Deposit', Icon: Lock },
  { to: '/savings-goals', label: 'Savings Goals', Icon: Target },
];

const ACCOUNT_NAV = [
  { to: '/profile', label: 'Profile', Icon: User },
  { to: '/security', label: 'Security', Icon: ShieldCheck },
];

export default function AppLayout() {
  const { user, logout, isAdmin } = useAuthStore();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);

  function handleLogout() {
    try { authApi.logout().catch(() => {}); } catch { }
    logout();
    navigate('/');
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${isActive ? 'bg-white/10 text-white' : 'text-white/65 hover:text-white hover:bg-white/5'}`;

  const sectionLabel = (label: string) => (
    <p className="text-white/30 text-xs uppercase tracking-widest px-3 pt-3 pb-1">{label}</p>
  );

  return (
    <div className={`min-h-screen flex ${dark ? 'bg-gray-950' : 'bg-gray-50'}`}>
      <aside className="w-56 bg-emerald-900 flex flex-col flex-shrink-0">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/10">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Oakstone 1 Bank" className="w-8 h-8 object-contain flex-shrink-0" />
            <div>
              <p className="text-white font-semibold text-sm leading-tight">Oakstone 1 Bank</p>
              <p className="text-emerald-400 text-xs">Prototype</p>
            </div>
          </Link>
        </div>

        {/* User */}
        <div className="px-3 py-3 border-b border-white/10">
          <div className="bg-white/5 rounded-md px-3 py-2">
            <p className="text-white text-xs font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-white/50 text-xs truncate">{user?.email}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {sectionLabel('Banking')}
          {NAV.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={navClass}>
              <Icon size={15} className="flex-shrink-0" />
              {label}
            </NavLink>
          ))}

          {sectionLabel('Wealth')}
          {WEALTH_NAV.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={navClass}>
              <Icon size={15} className="flex-shrink-0" />
              {label}
            </NavLink>
          ))}

          {sectionLabel('Account')}
          {ACCOUNT_NAV.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={navClass}>
              <Icon size={15} className="flex-shrink-0" />
              {label}
            </NavLink>
          ))}

          {isAdmin() && (
            <>
              {sectionLabel('Admin')}
              <NavLink to="/admin/dashboard" className={navClass}>
                <Shield size={15} className="flex-shrink-0" />
                Admin panel
              </NavLink>
            </>
          )}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-white/10 space-y-1">
          <button
            onClick={() => setDark(d => !d)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-white/65 hover:text-white hover:bg-white/5 transition-colors"
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
            {dark ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-white hover:bg-white/5 transition-colors"
          >
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