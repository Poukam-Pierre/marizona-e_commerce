'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';
import { useAuthStore } from '@/stores/auth-store';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, hydrated } = useAuthStore();
  const [initialized, setInitialized] = useState(false);

  // Wait for hydration
  useEffect(() => {
    if (hydrated) {
      // Small delay to ensure state is fully synced
      const timer = setTimeout(() => {
        setInitialized(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [hydrated]);

  // Handle redirects after initialization
  useEffect(() => {
    if (!initialized) return;

    const isLoginPage = pathname === '/login';
    const isRootPage = pathname === '/';

    if (isAuthenticated) {
      // Redirect away from login/root if authenticated
      if (isLoginPage || isRootPage) {
        router.replace('/dashboard');
      }
    } else {
      // Redirect to login if not authenticated and not on login page
      if (!isLoginPage) {
        router.replace('/login');
      }
    }
  }, [initialized, isAuthenticated, pathname, router]);

  // Show loading during hydration
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
