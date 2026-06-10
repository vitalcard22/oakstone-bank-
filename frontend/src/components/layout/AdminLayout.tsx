import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { authApi } from '../../services/api';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, Users, ShieldCheck, DollarSign,
  CreditCard, Landmark, Activity, AlertTriangle, FileText,
  LogOut, Home,
} from 'lucide-react';

const NAV = [
  { to: '/admin/dashboard',    label: 'Dashboard',        Icon: LayoutDashboard },
  { to: '/admin/users',        label: 'Users',            Icon: Users },
  { to: '/admin/kyc',          label: 'KYC queue',        Icon: ShieldCheck },
  { to: '/admin/card-fees',    label: 'Card fees',        Icon: DollarSign },
  { to: '/admin/cards',        label: 'Card applications', Icon: CreditCard },
  { to: '/admin/loans',        label: 'Loan applications', Icon: Landmark },
  { to: '/admin/transactions', label: 'Transactions',     Icon: Activity },
  { to: '/admin/fraud',        label: 'Fraud alerts',     Icon: AlertTriangle },
  { to: '/admin/audit',        label: 'Audit log',        Icon: FileText },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogout() {
    try { await authApi.logout(); } catch { /* ignore */ }
    logout();
    navigate('/login');
    toast.success('Signed out');
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 bg-navy-700 flex flex-col flex-shrink-0">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gold-500 rounded flex items-center justify-center">
              <svg viewBox="0 0 22 22" fill="none" className="w-4 h-4">
                <path d="M4 18V10L11 4L18 10V18H13V13H9V18H4Z" fill="white" />
              </svg>
            </div>
            <div>
              <p className="text-white text-sm font-semibold">Oakstone Admin</p>
              <p className="text-gold-400 text-xs capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) =>
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
          <NavLink to="/dashboard" className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">
            <Home size={15} />
            Customer view
          </NavLink>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
