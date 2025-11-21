"use client";

import { useEffect, useMemo, useState } from 'react';
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
  const [info, setInfo] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [pendingEmail, setPendingEmail] = useState<string | undefined>();
  const [pendingPassword, setPendingPassword] = useState<string | undefined>();
  const [pendingDisplayName, setPendingDisplayName] = useState<string | undefined>();
  const [otpCode, setOtpCode] = useState('');
  const isExtensionFlow = searchParams.get('ext') === 'true';
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  useEffect(() => {
    if (!isExtensionFlow || !accessToken) return;
    router.replace('/dashboard?source=extension');
  }, [accessToken, isExtensionFlow, router]);

  const completeSignup = (tokens: { accessToken: string; refreshToken: string }, user: any) => {
    login({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user });
    if (isExtensionFlow) {
      router.replace('/dashboard?source=extension');
    } else {
      router.push('/onboarding');
    }
  };

  const handleOtpRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email'));
    const password = String(form.get('password'));
    const displayName = String(form.get('displayName'));
    setLoading(true);
    setError(undefined);
    setInfo(undefined);
    setOtpCode('');
    try {
      await api.requestSignupOtp({ email, password, displayName, timezone });
      setPendingEmail(email);
      setPendingPassword(password);
      setPendingDisplayName(displayName);
      setStep('otp');
      setInfo('We sent a one-time code to your email. Enter it below to finish creating your account.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pendingEmail) {
      setError('Start from the signup form.');
      return;
    }
    setLoading(true);
    setError(undefined);
    setInfo(undefined);
    try {
      const response = await api.verifySignupOtp({ email: pendingEmail, code: otpCode.trim() });
      completeSignup(response.tokens, response.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!pendingEmail || !pendingPassword || !pendingDisplayName) return;
    setLoading(true);
    setError(undefined);
    setInfo(undefined);
    try {
      await api.requestSignupOtp({ email: pendingEmail, password: pendingPassword, displayName: pendingDisplayName, timezone });
      setInfo('We just sent a new code.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep('form');
    setPendingEmail(undefined);
    setPendingPassword(undefined);
    setPendingDisplayName(undefined);
    setOtpCode('');
    setError(undefined);
    setInfo(undefined);
  };

  const handleGoogle = async (credentialResponse: any) => {
    if (!credentialResponse.credential) return;
    try {
      setLoading(true);
      setError(undefined);
      const response = await api.google({ idToken: credentialResponse.credential });
      completeSignup(response.tokens, response.user);
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

        {(error || info) && (
          <div
            className={`mb-4 rounded-lg border px-3 py-3 text-sm ${
              error
                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
            }`}
          >
            {error ?? info}
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handleOtpRequest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Display Name</label>
              <input
                type="text"
                name="displayName"
                required
                disabled={loading}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email"
                name="email"
                required
                disabled={loading}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
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
              {loading ? 'Sending code…' : 'Send verification code'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Enter the 6-digit code we sent to <span className="font-semibold">{pendingEmail}</span>
              </p>
              <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Verification code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={otpCode}
                onChange={event => setOtpCode(event.target.value)}
                disabled={loading}
                className="w-full px-4 py-2 text-center tracking-[0.4em] text-lg rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
              <button type="button" onClick={resetFlow} className="underline">
                Use a different email
              </button>
              <button type="button" onClick={handleResend} disabled={loading} className="font-medium text-blue-600 dark:text-blue-400">
                Resend code
              </button>
            </div>
            <button
              type="submit"
              disabled={loading || otpCode.trim().length < 4}
              className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Verifying…' : 'Verify & Continue'}
            </button>
          </form>
        )}

        {googleEnabled && (
          <>
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-300 dark:bg-slate-700" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">OR</span>
              <div className="h-px flex-1 bg-slate-300 dark:bg-slate-700" />
            </div>
            <div className="flex justify-center">
              <GoogleLogin onSuccess={handleGoogle} onError={() => setError('Google sign up failed')} />
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
