"use client";

import { Suspense } from 'react';
import SignupForm from './signup-form';

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white dark:bg-slate-950" />}>
      <SignupForm />
    </Suspense>
  );
}
