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
    JWT_EXPIRES_IN: str({ default: '1h' }), // Increased from 15m to reduce refresh frequency
    JWT_REFRESH_TTL_DAYS: num({ default: 7 }), // Set to 7 days as requested
    GOOGLE_CLIENT_ID: str(),
    GOOGLE_CLIENT_SECRET: str(),
    GROQ_API_KEY: str(),
    SENTRY_DSN: str({ default: '' }),
    FRONTEND_URL: str(),
    EXTENSION_URL: str(),
    EXTENSION_URLS: str({ default: '' }),
    ADMIN_EMAILS: str({ default: '' }),
    SUPERADMIN_EMAIL: str({ default: '' }),
    SUPERADMIN_PASSWORD: str({ default: '' }),
    CORS_ADDITIONAL_ORIGINS: str({ default: '' }),
    BREVO_API_KEY: str(),
    BREVO_FROM_EMAIL: str(),
    BREVO_FROM_NAME: str({ default: 'Scrollwise' }),
    BREVO_TIMEOUT_MS: num({ default: 15000 }),
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
].filter((origin) => Boolean(origin));
const extensionSchemes = new Set();
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
const adminEmails = parseCsv(raw.ADMIN_EMAILS).map(email => email.toLowerCase());
export default {
    ...raw,
    isProduction: raw.NODE_ENV === 'production',
    allowedOrigins,
    extensionOrigins,
    adminEmails
};
