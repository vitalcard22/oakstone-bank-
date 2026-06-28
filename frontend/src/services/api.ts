/// <reference types="vite/client" />
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/auth.store';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1',
  withCredentials: true,
  timeout: 15_000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as any;

    // Skip refresh for auth routes to prevent hanging on login failures
    const isAuthRoute = original?.url?.includes('/auth/login') ||
                        original?.url?.includes('/auth/register') ||
                        original?.url?.includes('/auth/refresh') ||
                        original?._skipAuth;

    if (error.response?.status === 401 && !original._retry && !isAuthRoute) {
      original._retry = true;
      if (!refreshing) {
        refreshing = api.post('/auth/refresh')
          .then(({ data }) => {
            useAuthStore.getState().setAccessToken(data.accessToken);
            return data.accessToken as string;
          })
          .catch(() => {
            useAuthStore.getState().logout();
            return null;
          })
          .finally(() => { refreshing = null; });
      }
      const newToken = await refreshing;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  verifyLoginCode: (data: any) => api.post('/auth/login/verify-code', data),
  completeMfa: (data: any) => api.post('/auth/mfa/complete', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  updateMe: (data: any) => api.patch('/auth/me', data),
  setupMfa: () => api.post('/auth/mfa/setup'),
  verifyMfa: (data: any) => api.post('/auth/mfa/verify', data),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data: any) => api.post('/auth/reset-password', data),
  verifyEmail: (token: string) => api.get('/auth/verify-email', { params: { token } }),
};

// Accounts
export const accountApi = {
  list: () => api.get('/accounts'),
  open: (data: any) => api.post('/accounts', data),
  get: (id: string) => api.get(`/accounts/${id}`),
  transactions: (id: string) => api.get(`/accounts/${id}/transactions`),
  freeze: (id: string) => api.post(`/accounts/${id}/freeze`),
  unfreeze: (id: string) => api.post(`/accounts/${id}/unfreeze`),
};

// Transactions
export const txApi = {
  transfer: (data: any) => api.post('/transactions/transfer', data),
  zelle: (data: any) => api.post('/transactions/zelle', data),
  ach: (data: any) => api.post('/transactions/ach', data),
  wire: (data: any) => api.post('/transactions/wire', data),
  config: () => api.get('/transactions/config'),
  zelleLookup: (identifier: string) => api.get('/transactions/zelle/lookup', { params: { identifier } }),
  get: (id: string) => api.get(`/transactions/${id}`),
  history: (params?: any) => api.get('/transactions/history', { params }),
};

// Cards
export const cardApi = {
  feeConfig: () => api.get('/cards/fee-config'),
  applications: () => api.get('/cards/applications'),
  apply: (data: any) => api.post('/cards/apply', data),
  payFee: (appId: string, data: any) => api.post(`/cards/${appId}/pay-fee`, data),
  list: () => api.get('/cards'),
  freeze: (id: string) => api.post(`/cards/${id}/freeze`),
  unfreeze: (id: string) => api.post(`/cards/${id}/unfreeze`),
};

// Loans
export const loanApi = {
  apply: (data: any) => api.post('/loans/apply', data),
  list: () => api.get('/loans'),
  applications: () => api.get('/loans/applications'),
};

// Admin
export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),
  users: (search?: string) => api.get('/admin/users', { params: { search } }),
  setUserStatus: (id: string, data: any) => api.patch(`/admin/users/${id}/status`, data),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  getUserAccounts: (id: string) => api.get(`/admin/users/${id}/accounts`),
  createUserAccount: (id: string) => api.post(`/admin/users/${id}/accounts`, {}),
  freezeAccount: (userId: string, accountId: string) => api.post(`/admin/users/${userId}/accounts/${accountId}/freeze`),
  unfreezeAccount: (userId: string, accountId: string) => api.post(`/admin/users/${userId}/accounts/${accountId}/unfreeze`),
  getUserTransactions: (id: string) => api.get(`/admin/users/${id}/transactions`),
  creditUser: (id: string, data: any) => api.post(`/admin/users/${id}/credit`, data),
  debitUser: (id: string, data: any) => api.post(`/admin/users/${id}/debit`, data),
  kycQueue: () => api.get('/admin/kyc/queue'),
  approveKyc: (uid: string) => api.post(`/admin/kyc/${uid}/approve`),
  rejectKyc: (uid: string, reason: string) => api.post(`/admin/kyc/${uid}/reject`, { reason }),
  cardFees: () => api.get('/admin/card-fees'),
  updateCardFee: (type: string, data: any) => api.patch(`/admin/card-fees/${type}`, data),
  cardApplications: () => api.get('/admin/card-applications'),
  approveCard: (id: string, data: any) => api.post(`/admin/card-applications/${id}/approve`, data),
  rejectCard: (id: string, reason: string) => api.post(`/admin/card-applications/${id}/reject`, { reason }),
  freezeCard: (id: string) => api.post(`/admin/card-applications/${id}/freeze`),
  unfreezeCard: (id: string) => api.post(`/admin/card-applications/${id}/unfreeze`),
  deleteCard: (id: string) => api.delete(`/admin/card-applications/${id}`),
  loanApplications: () => api.get('/admin/loan-applications'),
  approveLoan: (id: string, data: any) => api.post(`/admin/loan-applications/${id}/approve`, data),
  rejectLoan: (id: string, reason: string) => api.post(`/admin/loan-applications/${id}/reject`, { reason }),
  transactions: (params?: any) => api.get('/admin/transactions', { params }),
  flagTransaction: (id: string) => api.post(`/admin/transactions/${id}/flag`),
  fraudAlerts: () => api.get('/admin/fraud-alerts'),
  resolveFraud: (id: string) => api.post(`/admin/fraud-alerts/${id}/resolve`),
  auditLog: () => api.get('/admin/audit-log'),
  fixedDeposits: (status?: string) => api.get('/wealth/admin/fixed-deposits', { params: { status } }),
  approveFixedDeposit: (id: string) => api.post(`/wealth/admin/fixed-deposits/${id}/approve`),
  payoutFixedDeposit: (id: string) => api.post(`/wealth/admin/fixed-deposits/${id}/payout`),
  rejectFixedDeposit: (id: string, reason: string) => api.post(`/wealth/admin/fixed-deposits/${id}/reject`, { reason }),
isaEnrollments: () => api.get('/wealth/admin/isa'),
  approveIsa: (id: string) => api.post(`/wealth/admin/isa/${id}/approve`),
  rejectIsa: (id: string, reason: string) => api.post(`/wealth/admin/isa/${id}/reject`, { reason }),
  isaWithdrawals: () => api.get('/wealth/admin/isa/withdrawals'),
  approveIsaWithdrawal: (id: string) => api.post(`/wealth/admin/isa/withdrawals/${id}/approve`),
  rejectIsaWithdrawal: (id: string, reason: string) => api.post(`/wealth/admin/isa/withdrawals/${id}/reject`, { reason }),
  retirementEnrollments: () => api.get('/wealth/admin/retirement'),
  approveRetirement: (id: string) => api.post(`/wealth/admin/retirement/${id}/approve`),
  rejectRetirement: (id: string, reason: string) => api.post(`/wealth/admin/retirement/${id}/reject`, { reason }),
  retirementWithdrawals: () => api.get('/wealth/admin/retirement/withdrawals'),
  approveRetirementWithdrawal: (id: string) => api.post(`/wealth/admin/retirement/withdrawals/${id}/approve`),
  rejectRetirementWithdrawal: (id: string, reason: string) => api.post(`/wealth/admin/retirement/withdrawals/${id}/reject`, { reason }),
  investmentEnrollments: () => api.get('/wealth/admin/investment'),
  approveInvestment: (id: string) => api.post(`/wealth/admin/investment/${id}/approve`),
  rejectInvestment: (id: string, reason: string) => api.post(`/wealth/admin/investment/${id}/reject`, { reason }),
  investmentWithdrawals: () => api.get('/wealth/admin/investment/withdrawals'),
  approveInvestmentWithdrawal: (id: string) => api.post(`/wealth/admin/investment/withdrawals/${id}/approve`),
  rejectInvestmentWithdrawal: (id: string, reason: string) => api.post(`/wealth/admin/investment/withdrawals/${id}/reject`, { reason }),
  savingsWithdrawals: () => api.get('/wealth/admin/savings/withdrawals'),
  approveSavingsWithdrawal: (id: string) => api.post(`/wealth/admin/savings/withdrawals/${id}/approve`),
  rejectSavingsWithdrawal: (id: string, reason: string) => api.post(`/wealth/admin/savings/withdrawals/${id}/reject`, { reason }),
};

export const wealthApi = {
  fixedDeposits: () => api.get('/wealth/fixed-deposits'),
  applyFixedDeposit: (data: any) => api.post('/wealth/fixed-deposits', data),
  savingsGoals: () => api.get('/wealth/savings-goals'),
  createSavingsGoal: (data: any) => api.post('/wealth/savings-goals', data),
  contributeSavingsGoal: (id: string, amount: number) => api.post(`/wealth/savings-goals/${id}/contribute`, { amount }),
  withdrawSavingsGoal: (id: string, amount: number) => api.post(`/wealth/savings-goals/${id}/withdraw`, { amount }),
  deleteSavingsGoal: (id: string) => api.delete(`/wealth/savings-goals/${id}`),
  isa: () => api.get('/wealth/isa'),
  enrollIsa: (accountId: string) => api.post('/wealth/isa/enroll', { accountId }),
  contributeIsa: (data: any) => api.post('/wealth/isa/contribute', data),
  withdrawIsa: (amount: number) => api.post('/wealth/isa/withdraw', { amount }),
  retirement: () => api.get('/wealth/retirement'),
  enrollRetirement: (accountId: string) => api.post('/wealth/retirement/enroll', { accountId }),
  contributeRetirement: (amount: number) => api.post('/wealth/retirement/contribute', { amount }),
  withdrawRetirement: (amount: number) => api.post('/wealth/retirement/withdraw', { amount }),
  hub: () => api.get('/wealth/hub'),
  investment: () => api.get('/wealth/investment'),
  enrollInvestment: (accountId: string) => api.post('/wealth/investment/enroll', { accountId }),
  buyInvestment: (symbol: string, shares: number) => api.post('/wealth/investment/buy', { symbol, shares }),
  sellInvestment: (symbol: string, shares: number) => api.post('/wealth/investment/sell', { symbol, shares }),
};
