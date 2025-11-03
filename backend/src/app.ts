import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import routes from './routes/index.js';
import env from './config/env.js';
import errorHandler from './middleware/errorHandler.js';
import logger from './utils/logger.js';

const isLocalhost = (origin: string) => /^https?:\/\/localhost(?::\d+)?$/i.test(origin);

const normalizeOrigin = (origin: string) => origin.replace(/\/$/, '');

const createServer = () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          return callback(null, true);
        }

        const normalisedOrigin = normalizeOrigin(origin);
        const allowlisted = Array.isArray(env.allowedOrigins) && env.allowedOrigins.includes(normalisedOrigin);
        const permitted = allowlisted || (!env.isProduction && isLocalhost(normalisedOrigin));

        if (permitted) {
          return callback(null, true);
        }

        logger.warn({ origin }, 'Blocked CORS origin');
        const corsError = new Error('Not allowed by CORS');
        (corsError as any).status = 403;
        return callback(corsError);
      },
      credentials: true
    })
  );
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 200,
      standardHeaders: true,
      legacyHeaders: false
    })
  );
  app.use('/api', routes);
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use(errorHandler);
  return app;
};

export default createServer;
