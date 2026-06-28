import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { authApi } from '../../services/api';
import toast from 'react-hot-toast';
import SessionTimeout from './SessionTimeout';
import {
  LayoutDashboard, Users, ShieldCheck, DollarSign,
  CreditCard, Landmark, Activity, AlertTriangle, FileText, Lock, PiggyBank, TrendingUp, Target,
  LogOut, Home, Menu, X,
} from 'lucide-react';
import { useState } from 'react';

const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', Icon: Users },
  { to: '/admin/kyc', label: 'KYC queue', Icon: ShieldCheck },
  { to: '/admin/card-fees', label: 'Card fees', Icon: DollarSign },
  { to: '/admin/cards', label: 'Card applications', Icon: CreditCard },
  { to: '/admin/loans', label: 'Loan applications', Icon: Landmark },
  { to: '/admin/fixed-deposits', label: 'Fixed deposits', Icon: Lock },
  { to: '/admin/retirement', label: '401(k) enrollments', Icon: PiggyBank },
  { to: '/admin/investment', label: 'Investment enrollments', Icon: TrendingUp },
  { to: '/admin/roth-ira', label: 'Roth IRA enrollments', Icon: PiggyBank },
  { to: '/admin/savings', label: 'Savings withdrawals', Icon: Target },
  { to: '/admin/transactions', label: 'Transactions', Icon: Activity },
  { to: '/admin/fraud', label: 'Fraud alerts', Icon: AlertTriangle },
  { to: '/admin/audit', label: 'Audit log', Icon: FileText },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function handleLogout() {
    try { authApi.logout().catch(() => {}); } catch { /* ignore */ }
    logout();
    navigate('/login', { replace: true });
    toast('You have been signed out', { icon: '🔒' });
  }

  const closeDrawer = () => setOpen(false);

  return (
    <div className="min-h-screen md:flex bg-gray-50">

      <SessionTimeout />

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-navy-700 px-4 py-3">
        <Link to="/admin/dashboard" className="flex items-center gap-2">
          <img src="/logo.png" alt="Oakstones 1 Bank" className="w-7 h-7 object-contain" />
          <span className="text-white font-semibold text-sm">Oakstones 1 Bank</span>
        </Link>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="text-white p-1">
          <Menu size={22} />
        </button>
      </header>

      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={closeDrawer} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-navy-700 flex flex-col transform transition-transform duration-200 ease-in-out
          md:static md:z-auto md:w-56 md:translate-x-0 md:flex-shrink-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <Link to="/admin/dashboard" onClick={closeDrawer} className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Oakstones 1 Bank" className="w-8 h-8 object-contain flex-shrink-0" />
            <div>
              <p className="text-white text-sm font-semibold">Oakstones 1 Bank</p>
              <p className="text-gold-400 text-xs capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </Link>
          <button onClick={closeDrawer} aria-label="Close menu" className="md:hidden text-white/70 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} onClick={closeDrawer} className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`
            }>
              <Icon size={15} className="flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-2 border-t border-white/10 space-y-0.5">
          <NavLink to="/dashboard" onClick={closeDrawer} className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">
            <Home size={15} />
            Customer view
          </NavLink>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-white hover:text-white hover:bg-white/5 transition-colors">
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto min-w-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
