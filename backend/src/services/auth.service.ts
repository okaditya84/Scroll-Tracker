import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { Request, Response } from 'express';
import { CookieOptions } from 'express-serve-static-core';
import env from '../config/env.js';
import Session, { SessionDocument } from '../models/Session.js';
import User, { UserDocument } from '../models/User.js';
import { JwtPayload } from '../types/jwt.js';
import { ensureSuperadminRole } from '../utils/superadmin.js';

interface SessionBundle {
  accessToken: string;
  refreshToken: string;
  session: SessionDocument;
}

const REFRESH_COOKIE: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProduction,
  path: '/',
  maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000
};

const getUserId = (user: UserDocument) => user._id.toString();

const buildAccessToken = async (user: UserDocument, sessionId: string) => {
  // always read the most recent role from the database to avoid stale-document races
  const fresh = await User.findById(user._id).select('role email displayName');
  const role = (fresh as any)?.role ?? (user as any).role ?? 'user';

  const payload: Partial<JwtPayload> = {
    sub: getUserId(user),
    email: (fresh as any)?.email ?? user.email,
    displayName: (fresh as any)?.displayName ?? user.displayName,
    role,
    sessionId
  };

  const secret: Secret = env.JWT_SECRET;
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn']
  };

  return jwt.sign(payload, secret, options);
};

const generateRefreshSecret = () => crypto.randomBytes(48).toString('base64url');

export const createSession = async (user: UserDocument, req: Request): Promise<SessionBundle> => {
  const secret = generateRefreshSecret();
  const refreshTokenHash = await bcrypt.hash(secret, 10);
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  const session = await Session.create({
    userId: user._id,
    refreshTokenHash,
    userAgent: req.get('user-agent') ?? 'unknown',
    ip: req.ip,
    expiresAt
  });

  const refreshToken = `${session._id.toString()}.${secret}`;
  const accessToken = await buildAccessToken(user, session._id.toString());

  return { accessToken, refreshToken, session };
};

export const refreshTokens = async (refreshToken: string, req: Request): Promise<SessionBundle> => {
  const [sessionId, secret] = refreshToken.split('.');
  if (!sessionId || !secret) {
    throw new Error('Malformed refresh token');
  }

  const session = await Session.findById(sessionId);
  if (!session || session.revokedAt) {
    throw new Error('Invalid session');
  }

  if (session.expiresAt < new Date()) {
    throw new Error('Session expired');
  }

  const valid = await bcrypt.compare(secret, session.refreshTokenHash);
  if (!valid) {
    throw new Error('Token mismatch');
  }

  let user = await User.findById(session.userId);
  if (!user) {
    throw new Error('User missing');
  }

  user = (await ensureSuperadminRole(user))!;

  const nextSecret = generateRefreshSecret();
  session.refreshTokenHash = await bcrypt.hash(nextSecret, 10);
  session.lastUsedAt = new Date();
  session.userAgent = req.get('user-agent') ?? session.userAgent;
  session.ip = req.ip;
  session.expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await session.save();

  const nextRefreshToken = `${session._id.toString()}.${nextSecret}`;
  const accessToken = await buildAccessToken(user, session._id.toString());
  return { accessToken, refreshToken: nextRefreshToken, session };
};

export const revokeRefreshToken = async (refreshToken: string) => {
  const [sessionId] = refreshToken.split('.');
  if (!sessionId) {
    return;
  }
  const session = await Session.findById(sessionId);
  if (!session) {
    return;
  }
  session.revokedAt = new Date();
  await session.save();
};

export const attachRefreshCookie = (res: Response, refreshToken: string) => {
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE);
};

export const clearRefreshCookie = (res: Response) => {
  res.clearCookie('refreshToken', REFRESH_COOKIE);
};

export const mapUser = (user: UserDocument) => ({
  id: getUserId(user),
  email: user.email,
  displayName: user.displayName,
  avatarUrl: user.avatarUrl,
  timezone: user.timezone,
  role: user.role ?? 'user',
  accountStatus: (user as any).accountStatus ?? 'active',
  tracking: (user as any).tracking,
  presence: (user as any).presence,
  contact: (user as any).contact,
  habits: user.habits,
  createdAt: user.createdAt
});

export const serializeAuthResponse = (user: UserDocument, bundle: SessionBundle) => ({
  user: mapUser(user),
  tokens: {
    accessToken: bundle.accessToken,
    refreshToken: bundle.refreshToken
  },
  session: {
    id: bundle.session._id.toString(),
    expiresAt: bundle.session.expiresAt
  }
});
