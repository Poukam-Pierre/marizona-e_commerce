import './global.css';
import { AppProviders } from '../providers/app-providers';
import { AuthGuard } from '../components/layout/auth-guard';
import { RealtimeProvider } from '../providers/realtime-provider';

export const metadata = {
  title: 'ShopPk Admin',
  description: 'E-commerce Admin Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>
          <AuthGuard>
            <RealtimeProvider>
              {children}
            </RealtimeProvider>
          </AuthGuard>
        </AppProviders>
      </body>
    </html>
  );
}
