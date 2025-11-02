const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' }
    ]
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api',
    NEXT_PUBLIC_GOOGLE_CLIENT_ID:
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? '',
    NEXT_PUBLIC_EXTENSION_URL:
      process.env.NEXT_PUBLIC_EXTENSION_URL ?? process.env.EXTENSION_URL ?? ''
  }
};

export default nextConfig;
