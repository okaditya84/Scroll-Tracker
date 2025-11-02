import logger from '../utils/logger.js';
const errorHandler = (err, _req, res, _next) => {
    logger.error({ err }, 'Unhandled error');
    const status = err.status ?? 500;
    const message = status === 500 ? 'Unexpected error' : err.message;
    res.status(status).json({ error: message });
};
export default errorHandler;
