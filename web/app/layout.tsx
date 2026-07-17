import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'FitCoach — AI trenér & výživový poradce',
  description: 'Osobní AI trenér v kapse. Tréninkový plán, strava, regenerace — vše na míru.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FitCoach',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FAFBFC',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body>
        <AuthProvider>
          <div id="app-shell">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
