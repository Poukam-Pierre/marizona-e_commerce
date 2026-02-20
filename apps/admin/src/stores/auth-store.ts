import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AdminUser, AuthTokens } from '@/types';

interface AuthState {
  user: AdminUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  setUser: (user: AdminUser | null) => void;
  setTokens: (tokens: AuthTokens) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      hydrated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setTokens: (tokens) => set({ 
        accessToken: tokens.accessToken, 
        refreshToken: tokens.refreshToken 
      }),
      setAccessToken: (token) => set({ accessToken: token }),
      logout: () => set({ 
        user: null, 
        accessToken: null, 
        refreshToken: null, 
        isAuthenticated: false 
      }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'admin-auth-storage',
      skipHydration: false,
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
