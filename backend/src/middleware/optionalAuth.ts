import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { AuthRequest } from './auth.js';

const optionalAuth = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const raw = req.headers['authorization'];
  const authHeader = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as any;
    req.user = payload;
  } catch {
    // ignore invalid tokens for optional auth flows
  }
  next();
};

export default optionalAuth;
