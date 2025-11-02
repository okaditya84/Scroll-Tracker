import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import routes from './routes/index.js';
import env from './config/env.js';
import errorHandler from './middleware/errorHandler.js';
const createServer = () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(helmet());
    app.use(morgan(env.isProduction ? 'combined' : 'dev'));
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(cors({
        origin: [env.FRONTEND_URL, env.EXTENSION_URL],
        credentials: true
    }));
    app.use(rateLimit({
        windowMs: 60_000,
        max: 200,
        standardHeaders: true,
        legacyHeaders: false
    }));
    app.use('/api', routes);
    app.get('/health', (_req, res) => res.json({ status: 'ok' }));
    app.use(errorHandler);
    return app;
};
export default createServer;
