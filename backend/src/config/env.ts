import 'dotenv/config';
import { cleanEnv, str, port, num } from 'envalid';

const normalizeOrigin = (value?: string) => {
  if (!value) return undefined;
  if (/^(chrome|moz|ms)-extension:\/\//i.test(value)) {
    return value;
  }
  return value.replace(/\/$/, '');
};

const parseCsv = (value: string) =>
  value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

const raw = cleanEnv(process.env, {
  NODE_ENV: str({ default: 'development', choices: ['development', 'production', 'test'] }),
  PORT: port({ default: 3000 }),
  MONGODB_URI: str(),
  JWT_SECRET: str(),
  JWT_EXPIRES_IN: str({ default: '15m' }),
  JWT_REFRESH_TTL_DAYS: num({ default: 30 }),
  GOOGLE_CLIENT_ID: str(),
  GOOGLE_CLIENT_SECRET: str(),
  GROQ_API_KEY: str(),
  SENTRY_DSN: str({ default: '' }),
  FRONTEND_URL: str(),
  EXTENSION_URL: str(),
  EXTENSION_URLS: str({ default: '' }),
  SUPERADMIN_EMAIL: str({ default: '' }),
  SUPERADMIN_PASSWORD: str({ default: '' }),
  CORS_ADDITIONAL_ORIGINS: str({ default: '' }),
  SMTP_HOST: str(),
  SMTP_PORT: port({ default: 587 }),
  SMTP_USERNAME: str(),
  SMTP_PASSWORD: str(),
  SMTP_FROM_EMAIL: str(),
  SMTP_FROM_NAME: str({ default: 'Scrollwise' }),
  OTP_TTL_MINUTES: num({ default: 10 }),
  OTP_THROTTLE_PER_HOUR: num({ default: 5 }),
  OTP_MAX_ATTEMPTS: num({ default: 5 })
});

const extensionOrigins = [raw.EXTENSION_URL, ...parseCsv(raw.EXTENSION_URLS)]
  .map(entry => entry.trim())
  .filter(Boolean);

const baseAllowedOrigins = [
  normalizeOrigin(raw.FRONTEND_URL),
  ...extensionOrigins.map(normalizeOrigin),
  ...parseCsv(raw.CORS_ADDITIONAL_ORIGINS).map(normalizeOrigin)
].filter((origin): origin is string => Boolean(origin));

const extensionSchemes = new Set<string>();
for (const origin of extensionOrigins) {
  const match = origin.match(/^([a-z-]+-extension):\/\//i);
  if (match) {
    extensionSchemes.add(match[1].toLowerCase());
  }
}

const wildcardExtensionOrigins = extensionSchemes.size
  ? Array.from(extensionSchemes).map(scheme => `${scheme}://*`)
  : [];

const allowedOrigins = Array.from(new Set([...baseAllowedOrigins, ...wildcardExtensionOrigins]));

export default {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  allowedOrigins,
  extensionOrigins
};

