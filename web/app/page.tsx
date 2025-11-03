import Link from 'next/link';
import Image from 'next/image';
import { SparklesIcon } from '@heroicons/react/24/solid';

const featureItems = [
  {
    title: 'Track every scroll',
    description:
      'Live scroll, click, and idle tracking across tabs with playful nudges that keep you mindful.'
  },
  {
    title: 'Groq-powered insights',
    description:
      'Daily insights translate your digital activity into quirky comparisons and actionable steps.'
  },
  {
    title: 'Personalized goals',
    description:
      'Set daily balance goals, celebrate streaks, and visualise focus peaks with delightful visuals.'
  }
];

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-24">
        <header className="flex flex-col gap-8 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/60 bg-brand-500/10 px-4 py-2 text-xs uppercase tracking-[0.4em] text-brand-200">
              <SparklesIcon className="h-4 w-4" /> Scrollwise
            </span>
            <h1 className="text-5xl font-semibold leading-tight text-white sm:text-6xl">
              Scroll smarter, laugh harder, feel better.
            </h1>
            <p className="max-w-xl text-lg text-slate-300">
              Scrollwise tracks your browsing vibes and turns them into cheerful, health-first insights so you can master focus without losing the fun.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-glow transition hover:-translate-y-0.5"
              >
                Create free account
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/70"
              >
                I already have access
              </Link>
            </div>
          </div>
          <div className="flex flex-1 justify-center">
            <div className="relative h-[400px] w-[400px]">
              <Image src="/logo.svg" alt="Scrollwise Logo" fill className="object-contain" />
            </div>
          </div>
        </header>
        <section className="mt-24 grid gap-6 md:grid-cols-3">
          {featureItems.map(item => (
            <article
              key={item.title}
              className="rounded-3xl border border-white/5 bg-white/5 p-6 backdrop-blur transition hover:border-brand-400/60"
            >
              <h3 className="text-xl font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm text-slate-300">{item.description}</p>
            </article>
          ))}
        </section>
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-10 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-brand-500/20 blur-[180px]" />
      </div>
    </main>
  );
}
