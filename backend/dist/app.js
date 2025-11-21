import 'express-async-errors';
import express from 'express';
import * as Sentry from '@sentry/node';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import routes from './routes/index.js';
import authRoutes from './routes/auth.routes.js';
import env from './config/env.js';
import errorHandler from './middleware/errorHandler.js';
import logger from './utils/logger.js';
const isLocalhost = (origin) => /^https?:\/\/localhost(?::\d+)?$/i.test(origin);
const normalizeOrigin = (origin) => {
    if (/^(chrome|moz|ms)-extension:\/\//i.test(origin)) {
        return origin;
    }
    return origin.replace(/\/$/, '');
};
const originMatches = (incoming, allowed) => {
    if (!allowed) {
        return false;
    }
    const wildcard = allowed.endsWith('*');
    const target = wildcard ? allowed.slice(0, -1) : allowed;
    const normalisedIncoming = normalizeOrigin(incoming);
    const normalisedAllowed = normalizeOrigin(target);
    if (wildcard) {
        return normalisedIncoming.startsWith(normalisedAllowed);
    }
    return normalisedIncoming === normalisedAllowed;
};
const createServer = () => {
    const app = express();
    // Initialize Sentry if DSN is provided
    try {
        if (env.SENTRY_DSN) {
            Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });
            app.use(Sentry.Handlers.requestHandler());
        }
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Sentry initialization failed', err.message ?? err);
    }
    app.set('trust proxy', 1);
    app.use(helmet());
    app.use(morgan(env.isProduction ? 'combined' : 'dev'));
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(cors({
        origin(origin, callback) {
            if (!origin) {
                return callback(null, true);
            }
            const normalisedOrigin = normalizeOrigin(origin);
            const allowlisted = Array.isArray(env.allowedOrigins)
                && env.allowedOrigins.some(allowed => originMatches(origin, allowed));
            const permitted = allowlisted || (!env.isProduction && isLocalhost(normalisedOrigin));
            if (permitted) {
                return callback(null, true);
            }
            logger.warn({ origin }, 'Blocked CORS origin');
            const corsError = new Error('Not allowed by CORS');
            corsError.status = 403;
            return callback(corsError);
        },
        credentials: true
    }));
    app.use(rateLimit({
        windowMs: 60_000,
        max: 200,
        standardHeaders: true,
        legacyHeaders: false
    }));
    app.use('/auth', authRoutes);
    app.use('/api', routes);
    app.get('/health', (_req, res) => res.json({ status: 'ok' }));
    app.use(errorHandler);
    try {
        if (env.SENTRY_DSN) {
            app.use(Sentry.Handlers.errorHandler());
        }
    }
    catch (err) {
        // swallow
    }
    return app;
};
export default createServer;
