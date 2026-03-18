import './global.css';
import { AppProviders } from '../providers/app-providers';
import { AuthGuard } from '../components/layout/auth-guard';

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
            {children}
          </AuthGuard>
        </AppProviders>
      </body>
    </html>
  );
}
