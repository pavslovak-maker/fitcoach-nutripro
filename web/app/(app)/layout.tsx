'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useEffect } from 'react';

const tabs = [
  { href: '/', label: 'Dnes', icon: '🏠' },
  { href: '/workout', label: 'Trénink', icon: '💪' },
  { href: '/nutrition', label: 'Strava', icon: '🥗' },
  { href: '/progress', label: 'Progress', icon: '📊' },
  { href: '/profile', label: 'Profil', icon: '👤' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loading, authenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !authenticated) router.push('/auth');
  }, [loading, authenticated, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authenticated) return null;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Page content */}
      <main className="flex-1 pb-20 overflow-y-auto no-scrollbar">
        <div className="page-enter">
          {children}
        </div>
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 z-50">
        <div className="max-w-md mx-auto flex">
          {tabs.map((tab) => {
            const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
            return (
              <button
                key={tab.href}
                onClick={() => router.push(tab.href)}
                className={`flex-1 flex flex-col items-center py-2.5 transition-colors ${
                  active ? 'text-brand-500' : 'text-slate-400'
                }`}
              >
                <span className="text-xl leading-none">{tab.icon}</span>
                <span className="text-[10px] font-medium mt-0.5">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
