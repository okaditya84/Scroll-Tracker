import 'dotenv/config';
import { cleanEnv, str, port, num } from 'envalid';

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
  EXTENSION_URL: str()
});

export default {
  ...raw,
  isProduction: raw.NODE_ENV === 'production'
};
