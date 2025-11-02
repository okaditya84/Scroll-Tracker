import pino from 'pino';
import env from '../config/env.js';
const logger = pino({
    level: env.isProduction ? 'info' : 'debug',
    transport: env.isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
                colorize: true
            }
        }
});
export default logger;
