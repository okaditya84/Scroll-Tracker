"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from '@/hooks/useAuth';

const Providers = ({ children }: { children: ReactNode }) => {
  const [client] = useState(() => new QueryClient());
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!googleClientId) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('Google OAuth client id is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID.');
    }

    return (
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <QueryClientProvider client={client}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    );
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <QueryClientProvider client={client}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
};

export default Providers;
