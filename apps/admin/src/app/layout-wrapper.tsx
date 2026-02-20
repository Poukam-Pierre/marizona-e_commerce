'use client';

import { AdminLayout } from '@/components/layout/admin-layout';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
