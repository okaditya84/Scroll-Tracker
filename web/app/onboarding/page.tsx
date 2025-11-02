"use client";

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

const OnboardingPage = () => {
  const router = useRouter();
  const { accessToken } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/dashboard');
    }, 2500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white">
      <div className="rounded-3xl border border-white/10 bg-white/5 px-12 py-16 text-center shadow-2xl">
        <h1 className="text-4xl font-semibold">You&apos;re set, commander!</h1>
        <p className="mt-4 max-w-sm text-sm text-slate-300">
          Synchronising your scroll radar and prepping Groq insights. We&apos;ll drop you into the
          cockpit in a blink.
        </p>
        {!accessToken && <p className="mt-6 text-xs text-red-300">Missing auth token. Please log in.</p>}
      </div>
    </main>
  );
};

export default OnboardingPage;
