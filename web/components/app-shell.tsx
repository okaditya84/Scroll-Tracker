"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface NavLink {
  label: string;
  href: string;
  requireAdmin?: boolean;
}

const NAV_LINKS: NavLink[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Analytics', href: '/dashboard/analytics' },
  { label: 'Focus Mode', href: '/dashboard/focus' },
  { label: 'Admin', href: '/admin', requireAdmin: true },
  { label: 'Terms', href: '/legal/terms' },
  { label: 'Privacy', href: '/legal/privacy' },
  { label: 'Contact', href: '/legal/contact' }
];

const FOOTER_LINKS = [
  { label: 'Terms & Conditions', href: '/legal/terms' },
  { label: 'Privacy Policy', href: '/legal/privacy' },
  { label: 'Contact Us', href: '/legal/contact' }
];

const AppShell = ({ children }: { children: ReactNode }) => {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const links = useMemo(() => {
    return NAV_LINKS.filter(link => (link.requireAdmin ? user?.role === 'admin' || user?.role === 'superadmin' : true));
  }, [user?.role]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-white/80 backdrop-blur dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white flex items-center justify-center font-semibold">
                S
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Scrollwise</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Mindful browsing</p>
              </div>
            </Link>
            <nav className="hidden gap-4 text-sm font-medium text-slate-600 sm:flex dark:text-slate-300">
              {links.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-3 py-1 transition hover:bg-slate-100 dark:hover:bg-slate-900 ${pathname?.startsWith(link.href) ? 'text-slate-900 dark:text-white' : ''
                    }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {!loading && user && (
              <span className="hidden text-slate-600 dark:text-slate-300 sm:inline-flex">Hi, {user.displayName}</span>
            )}
            {user ? (
              <button
                className="rounded-full border border-slate-300 px-4 py-1.5 text-slate-700 transition hover:border-slate-500 dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-500"
                onClick={() => logout().then(() => router.push('/login'))}
              >
                Logout
              </button>
            ) : (
              <button
                className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={() => router.push('/login')}
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>
      <div className="pb-32 pt-8">
        {children}
      </div>
      <footer className="border-t border-slate-200 bg-white/80 px-4 py-8 dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Scrollwise. Crafted for thoughtful browsing.</p>
          <div className="flex flex-wrap gap-4">
            {FOOTER_LINKS.map(link => (
              <Link key={link.href} href={link.href} className="hover:text-slate-900 dark:hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppShell;
