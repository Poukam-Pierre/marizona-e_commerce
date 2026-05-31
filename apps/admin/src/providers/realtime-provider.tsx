'use client';

import { useAdminRealtime } from '@/hooks/use-admin-realtime';

/**
 * Mounts the global admin Realtime subscription for the lifetime of an
 * authenticated session. Must be rendered inside both QueryClientProvider
 * (so useQueryClient() resolves) and AuthGuard (so we only subscribe after
 * the user is confirmed authenticated).
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useAdminRealtime();
  return <>{children}</>;
}
