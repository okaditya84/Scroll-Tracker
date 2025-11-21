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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isExtensionFlow = searchParams.get('ext') === 'true';
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const passwordHasMinLength = password.length >= 8;
  const passwordHasSpecial = /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordChecklist = [
    { id: 'length', label: 'At least 8 characters', met: passwordHasMinLength, pending: password.length === 0 },
    { id: 'special', label: 'Includes a special character', met: passwordHasSpecial, pending: password.length === 0 },
    { id: 'match', label: 'Passwords match', met: passwordsMatch, pending: confirmPassword.length === 0 }
  ];
  const canSubmitPassword = passwordHasMinLength && passwordHasSpecial && passwordsMatch;

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
    if (!canSubmitPassword) {
      setError('Please meet the password requirements before continuing.');
      return;
    }
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email'));
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
  setPassword('');
  setConfirmPassword('');
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
    setPassword('');
    setConfirmPassword('');
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
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-2 pr-12 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  className="absolute inset-y-0 right-3 flex items-center text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                  disabled={loading}
                  className={`w-full px-4 py-2 pr-12 rounded-lg border ${passwordsMatch || confirmPassword.length === 0 ? 'border-slate-300 dark:border-slate-700' : 'border-red-400 dark:border-red-500'} bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${passwordsMatch ? 'focus:ring-emerald-500' : 'focus:ring-blue-500'} disabled:opacity-50`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(value => !value)}
                  className="absolute inset-y-0 right-3 flex items-center text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Password rules</p>
              <div className="mt-3 space-y-2">
                {passwordChecklist.map(rule => {
                  const stateClass = rule.met
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : rule.pending
                      ? 'text-slate-500 dark:text-slate-500'
                      : 'text-red-500 dark:text-red-400';
                  const badgeClass = rule.met
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
                  return (
                    <div key={rule.id} className={`flex items-center gap-2 text-sm ${stateClass}`}>
                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${badgeClass}`}>
                        {rule.met ? '✓' : '•'}
                      </span>
                      <span>{rule.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !canSubmitPassword}
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
