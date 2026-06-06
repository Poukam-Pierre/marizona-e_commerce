'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';
import { useAuthStore } from '@/stores/auth-store';
import { supabase } from '@/lib/supabase';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, setSession, setHydrated, hydrated } = useAuthStore();
  const [initialized, setInitialized] = useState(false);

  // Bootstrap: load existing session, then subscribe to auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setHydrated(true);
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession, setHydrated]);

  // Handle redirects after initialization
  useEffect(() => {
    if (!initialized) return;

    const isLoginPage = pathname === '/login';
    const isRootPage = pathname === '/';

    if (isAuthenticated) {
      if (isLoginPage || isRootPage) {
        router.replace('/dashboard');
      }
    } else {
      if (!isLoginPage) {
        router.replace('/login');
      }
    }
  }, [initialized, isAuthenticated, pathname, router]);

  // Show loading until session is resolved
  if (!hydrated || !initialized) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Don't block the login page for unauthenticated users
  if (pathname === '/login' && !isAuthenticated) {
    return <>{children}</>;
  }

  // Show loading if redirecting
  if (!isAuthenticated && pathname !== '/login') {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return <>{children}</>;
}
