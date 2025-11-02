import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { JwtPayload } from '../types/jwt.js';

export interface AuthRequest<P = Record<string, unknown>, ResBody = any, ReqBody = any, ReqQuery = any>
  extends Request<P, ResBody, ReqBody, ReqQuery> {
  user?: JwtPayload;
}

const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const raw = req.headers['authorization'];
  const authHeader = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export default requireAuth;
