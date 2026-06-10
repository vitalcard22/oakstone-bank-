import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id:         string;
  email:      string;
  firstName:  string;
  lastName:   string;
  role:       'customer' | 'admin' | 'super_admin';
  kycStatus:  string;
  mfaEnabled: boolean;
}

interface AuthState {
  user:            User | null;
  accessToken:     string | null;
  setUser:         (user: User) => void;
  setAccessToken:  (token: string) => void;
  logout:          () => void;
  isAdmin:         () => boolean;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:           null,
      accessToken:    null,
      setUser:        (user) => set({ user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      logout:         () => set({ user: null, accessToken: null }),
      isAdmin:        () => ['admin','super_admin'].includes(get().user?.role ?? ''),
      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name:        'oakstone-auth',
      partialize:  (s) => ({ user: s.user, accessToken: s.accessToken }),
    }
  )
);

// Normalize snake_case DB response to camelCase for the store
export function normalizeUser(u: any): User {
  return {
    id:         u.id,
    email:      u.email,
    firstName:  u.first_name,
    lastName:   u.last_name,
    role:       u.role,
    kycStatus:  u.kyc_status,
    mfaEnabled: u.mfa_enabled,
  };
}
