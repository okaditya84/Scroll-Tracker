import { NextFunction, Request, Response } from 'express';
import logger from '../utils/logger.js';

const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  const status = err.status ?? 500;
  const message = status === 500 ? 'Unexpected error' : err.message;
  res.status(status).json({ error: message });
};

export default errorHandler;
