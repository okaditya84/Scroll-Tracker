"use client";

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoogleLogin } from '@react-oauth/google';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

const LoginPageContent = () => {
  const router = useRouter();
  const params = useSearchParams();
  const { login, accessToken, user } = useAuth();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const isExtensionFlow = params.get('ext') === 'true';

  const navigateAfterAuth = useCallback((role?: string) => {
    const isAdmin = role === 'admin' || role === 'superadmin';
    const baseRoute = isAdmin ? '/admin' : '/dashboard';
    const target = !isAdmin && isExtensionFlow ? '/dashboard?source=extension' : baseRoute;
    router.replace(target);
  }, [isExtensionFlow, router]);

  useEffect(() => {
    if (!accessToken || !user) return;
    navigateAfterAuth(user.role);
  }, [accessToken, user, navigateAfterAuth]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email'));
    const password = String(form.get('password'));
    setLoading(true);
    setError(undefined);
    try {
      const response = await api.login({ email, password });
      login({ accessToken: response.tokens.accessToken, refreshToken: response.tokens.refreshToken, user: response.user });
      navigateAfterAuth(response.user.role);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (credentialResponse: any) => {
    if (!credentialResponse.credential) return;
    try {
      const response = await api.google({ idToken: credentialResponse.credential });
      login({ accessToken: response.tokens.accessToken, refreshToken: response.tokens.refreshToken, user: response.user });
      navigateAfterAuth(response.user.role);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-10 shadow-2xl">
        <h1 className="text-3xl font-semibold text-white">Welcome back 👋</h1>
        <p className="mt-2 text-sm text-slate-400">
          Keep your scroll adventures in sync across the extension and web.
        </p>
        <form onSubmit={handleLogin} className="mt-8 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Email</label>
            <input
              name="email"
              type="email"
              required
              placeholder="you@email.com"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-white outline-none transition focus:border-brand-500"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Password</label>
            <input
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-white outline-none transition focus:border-brand-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Signing you in…' : 'Log in'}
          </button>
        </form>
        <div className="mt-6 text-center text-xs uppercase tracking-[0.4em] text-slate-600">or</div>
        <div className="mt-4 flex justify-center">
          {googleEnabled ? (
            <GoogleLogin onSuccess={handleGoogle} onError={() => setError('Google sign-in failed')} useOneTap={false} />
          ) : (
            <p className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-xs text-slate-400">
              Google sign-in is disabled. Ask your administrator to configure NEXT_PUBLIC_GOOGLE_CLIENT_ID.
            </p>
          )}
        </div>
        {error && (
          <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}
        <p className="mt-6 text-sm text-slate-400">
          New to Scrollwise?{' '}
          <Link href={isExtensionFlow ? '/signup?ext=true' : '/signup'} className="text-white underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
};

const LoginPage = () => (
  <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Loading…</div>}>
    <LoginPageContent />
  </Suspense>
);

export default LoginPage;
