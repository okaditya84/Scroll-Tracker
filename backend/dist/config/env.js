import 'dotenv/config';
import { cleanEnv, str, port, num } from 'envalid';
const normalizeOrigin = (value) => {
    if (!value)
        return undefined;
    if (/^(chrome|moz|ms)-extension:\/\//i.test(value)) {
        return value;
    }
    return value.replace(/\/$/, '');
};
const parseCsv = (value) => value
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
    CORS_ADDITIONAL_ORIGINS: str({ default: '' })
});
const extensionOrigins = [raw.EXTENSION_URL, ...parseCsv(raw.EXTENSION_URLS)]
    .map(entry => entry.trim())
    .filter(Boolean);
const allowedOrigins = Array.from(new Set([normalizeOrigin(raw.FRONTEND_URL), ...extensionOrigins.map(normalizeOrigin), ...parseCsv(raw.CORS_ADDITIONAL_ORIGINS).map(normalizeOrigin)]
    .filter((origin) => Boolean(origin))));
export default {
    ...raw,
    isProduction: raw.NODE_ENV === 'production',
    allowedOrigins,
    extensionOrigins
};
