"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { api } from '@/lib/api';
import type { PolicyPayload } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

type PolicySlug = PolicyPayload['slug'];

const titles: Record<PolicySlug, string> = {
  terms: 'Terms & Conditions',
  privacy: 'Privacy Policy',
  contact: 'Contact Scrollwise'
};

const descriptions: Record<PolicySlug, string> = {
  terms: 'Understand the agreement that governs Scrollwise membership.',
  privacy: 'Learn how we collect, store, and safeguard telemetry.',
  contact: 'Reach us for billing, partnerships, or general support.'
};

const PolicyPage = ({ slug }: { slug: PolicySlug }) => {
  const { accessToken, user } = useAuth();
  const [form, setForm] = useState({ name: user?.displayName ?? '', email: user?.email ?? '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const policyQuery = useQuery({
    queryKey: ['policy', slug],
    queryFn: () => api.contentGetPolicy(slug)
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await api.submitContactMessage(form, accessToken);
      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const policy = policyQuery.data;

  if (policyQuery.isLoading) {
    return <main className="mx-auto max-w-4xl px-6 py-12 text-slate-500">Loading document…</main>;
  }

  if (policyQuery.isError) {
    return <main className="mx-auto max-w-4xl px-6 py-12 text-rose-500">Unable to load this page right now.</main>;
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 text-slate-900 dark:text-white">
      <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{slug}</p>
      <h1 className="mt-3 text-4xl font-semibold">{titles[slug]}</h1>
      <p className="mt-2 text-slate-500 dark:text-slate-300">{descriptions[slug]}</p>
      {policy && (
        <p className="mt-2 text-xs text-slate-400">Updated {formatDistanceToNow(new Date(policy.updatedAt), { addSuffix: true })}</p>
      )}

      {slug !== 'contact' && (
        <article className="prose prose-slate mt-8 max-w-none dark:prose-invert">
          {policy?.body?.split('\n').map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </article>
      )}

      {slug === 'contact' && (
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          {submitted ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/30 dark:text-emerald-200">
              Thanks! Our team will reply within one business day.
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Name</label>
                <input
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Email</label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  value={form.email}
                  onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Subject</label>
                <input
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  value={form.subject}
                  onChange={e => setForm(prev => ({ ...prev, subject: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Message</label>
                <textarea
                  className="mt-1 h-32 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  value={form.message}
                  onChange={e => setForm(prev => ({ ...prev, message: e.target.value }))}
                  required
                />
              </div>
              {error && <p className="text-sm text-rose-500">{error}</p>}
              <button
                type="submit"
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900"
              >
                Send message
              </button>
            </form>
          )}
        </section>
      )}
    </main>
  );
};

export default PolicyPage;
