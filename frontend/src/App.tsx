import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/auth.store';
import AppLayout from './components/layout/AppLayout';
import AdminLayout from './components/layout/AdminLayout';

import LandingPage from './pages/LandingPage';
import PrivacyPolicy from './pages/legal/PrivacyPolicy';
import TermsOfService from './pages/legal/TermsOfService';
import CookiePolicy from './pages/legal/CookiePolicy';
import RiskDisclosure from './pages/legal/RiskDisclosure';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import MfaPage from './pages/auth/MfaPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import LoginCodePage from './pages/auth/LoginCodePage';

import DashboardPage from './pages/dashboard/DashboardPage';
import AccountsPage from './pages/dashboard/AccountsPage';
import AccountDetailPage from './pages/dashboard/AccountDetailPage';
import TransferPage from './pages/dashboard/TransferPage';
import TransferReceiptPage from './pages/dashboard/TransferReceiptPage';
import TransactionsPage from './pages/dashboard/TransactionsPage';
import ZellePage from './pages/dashboard/ZellePage';
import CardsPage from './pages/dashboard/CardsPage';
import CardApplyPage from './pages/dashboard/CardApplyPage';
import LoansPage from './pages/dashboard/LoansPage';
import LoanApplyPage from './pages/dashboard/LoanApplyPage';
import NotificationsPage from './pages/dashboard/NotificationsPage';
import ProfilePage from './pages/dashboard/ProfilePage';
import WealthHubPage from './pages/dashboard/WealthHubPage';
import InvestmentPage from './pages/dashboard/InvestmentPage';
import PensionPage from './pages/dashboard/PensionPage';
import ISAPage from './pages/dashboard/ISAPage';
import FixedDepositPage from './pages/dashboard/FixedDepositPage';
import SavingsGoalsPage from './pages/dashboard/SavingsGoalsPage';
import SecurityPage from './pages/dashboard/SecurityPage';

import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminKycPage from './pages/admin/AdminKycPage';
import AdminCardFeesPage from './pages/admin/AdminCardFeesPage';
import AdminCardsPage from './pages/admin/AdminCardsPage';
import AdminLoansPage from './pages/admin/AdminLoansPage';
import AdminFixedDepositsPage from './pages/admin/AdminFixedDepositsPage';
import AdminTransactionsPage from './pages/admin/AdminTransactionsPage';
import AdminFraudPage from './pages/admin/AdminFraudPage';
import AdminAuditPage from './pages/admin/AdminAuditPage';

const queryClient = new QueryClient();

function Auth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
}

function Admin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuthStore();
  return isAdmin() ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" />
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/cookies" element={<CookiePolicy />} />
          <Route path="/disclosures" element={<RiskDisclosure />} />

          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/login-code" element={<LoginCodePage />} />
          <Route path="/mfa" element={<MfaPage />} />

          {/* Dashboard */}
          <Route path="/" element={<Auth><AppLayout /></Auth>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/accounts/:id" element={<AccountDetailPage />} />
            <Route path="/transfer" element={<TransferPage />} />
            <Route path="/transfer/receipt/:id" element={<TransferReceiptPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/zelle" element={<ZellePage />} />
            <Route path="/cards" element={<CardsPage />} />
            <Route path="/cards/apply" element={<CardApplyPage />} />
            <Route path="/loans" element={<LoansPage />} />
            <Route path="/loans/apply" element={<LoanApplyPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/wealth" element={<WealthHubPage />} />
            <Route path="/investment" element={<InvestmentPage />} />
            <Route path="/pension" element={<PensionPage />} />
            <Route path="/isa" element={<ISAPage />} />
            <Route path="/fixed-deposit" element={<FixedDepositPage />} />
            <Route path="/savings-goals" element={<SavingsGoalsPage />} />
            <Route path="/security" element={<SecurityPage />} />
          </Route>

          {/* Admin */}
          <Route path="/admin" element={<Auth><Admin><AdminLayout /></Admin></Auth>}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="kyc" element={<AdminKycPage />} />
            <Route path="card-fees" element={<AdminCardFeesPage />} />
            <Route path="cards" element={<AdminCardsPage />} />
            <Route path="loans" element={<AdminLoansPage />} />
            <Route path="fixed-deposits" element={<AdminFixedDepositsPage />} />
            <Route path="transactions" element={<AdminTransactionsPage />} />
            <Route path="fraud" element={<AdminFraudPage />} />
            <Route path="audit" element={<AdminAuditPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
