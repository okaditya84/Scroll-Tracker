"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoogleLogin } from '@react-oauth/google';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, accessToken } = useAuth();
  const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const isExtensionFlow = searchParams.get('ext') === 'true';

  useEffect(() => {
    if (!isExtensionFlow || !accessToken) return;
    router.replace('/dashboard?source=extension');
  }, [accessToken, isExtensionFlow, router]);

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email'));
    const password = String(form.get('password'));
    const displayName = String(form.get('displayName'));
    setLoading(true);
    setError(undefined);
    try {
      const response = await api.register({ email, password, displayName });
      login({ accessToken: response.tokens.accessToken, refreshToken: response.tokens.refreshToken, user: response.user });
      if (isExtensionFlow) {
        router.replace('/dashboard?source=extension');
      } else {
        router.push('/onboarding');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (credentialResponse: any) => {
    if (!credentialResponse.credential) return;
    try {
      setLoading(true);
      setError(undefined);
      const response = await api.google({ idToken: credentialResponse.credential });
      login({ accessToken: response.tokens.accessToken, refreshToken: response.tokens.refreshToken, user: response.user });
      if (isExtensionFlow) {
        router.replace('/dashboard?source=extension');
      } else {
        router.push('/onboarding');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Create Account</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Join ScrollWise and start tracking your digital habits</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Display Name
            </label>
            <input
              type="text"
              name="displayName"
              required
              disabled={loading}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              required
              disabled={loading}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              disabled={loading}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Creating account…' : 'Sign Up'}
          </button>
        </form>

        {googleEnabled && (
          <>
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-300 dark:bg-slate-700" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">OR</span>
              <div className="h-px flex-1 bg-slate-300 dark:bg-slate-700" />
            </div>

            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogle}
                onError={() => setError('Google sign up failed')}
              />
            </div>
          </>
        )}

        <div className="mt-6 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
