import { notFound } from 'next/navigation';
import PolicyPage from '@/components/legal/policy-page';

const ALLOWED = ['terms', 'privacy', 'contact'] as const;

export default function LegalPage({ params }: { params: { slug: string } }) {
  if (!ALLOWED.includes(params.slug as (typeof ALLOWED)[number])) {
    notFound();
  }
  return <PolicyPage slug={params.slug as (typeof ALLOWED)[number]} />;
}
