import './globals.css';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import Providers from '@/components/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Scrollwise — Playful browsing coach',
  description: 'Transform your scrolling into mindful momentum.',
  icons: {
    icon: '/logo.svg'
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50`}> 
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
