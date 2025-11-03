import 'dotenv/config';
import { cleanEnv, str, port, num } from 'envalid';

const normalizeOrigin = (value?: string) => {
  if (!value) return undefined;
  return value.replace(/\/$/, '');
};

const parseCsv = (value: string) =>
  value
    .split(',')
    .map(item => normalizeOrigin(item.trim()))
    .filter((item): item is string => Boolean(item));

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
  FRONTEND_URL: str(),
  EXTENSION_URL: str(),
  CORS_ADDITIONAL_ORIGINS: str({ default: '' })
});

const allowedOrigins = Array.from(
  new Set(
    [normalizeOrigin(raw.FRONTEND_URL), normalizeOrigin(raw.EXTENSION_URL), ...parseCsv(raw.CORS_ADDITIONAL_ORIGINS)]
      .filter((origin): origin is string => Boolean(origin))
  )
);

export default {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  allowedOrigins
};
