'use client';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { PWAInstallPrompt } from '@/components/ui/pwa-install-prompt';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <PWAInstallPrompt />
    </div>
  );
}
