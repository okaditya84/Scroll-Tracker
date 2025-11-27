import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import { ensureSuperadminRole } from '../utils/superadmin.js';
const REFRESH_COOKIE = {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/',
    maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000
};
const getUserId = (user) => user._id.toString();
const buildAccessToken = async (user, sessionId) => {
    // always read the most recent role from the database to avoid stale-document races
    const fresh = await User.findById(user._id).select('role email displayName');
    const role = fresh?.role ?? user.role ?? 'user';
    const payload = {
        sub: getUserId(user),
        email: fresh?.email ?? user.email,
        displayName: fresh?.displayName ?? user.displayName,
        role,
        sessionId
    };
    const secret = env.JWT_SECRET;
    const options = {
        expiresIn: env.JWT_EXPIRES_IN
    };
    return jwt.sign(payload, secret, options);
};
const generateRefreshSecret = () => crypto.randomBytes(48).toString('base64url');
export const createSession = async (user, req) => {
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
export const refreshTokens = async (refreshToken, req) => {
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
    user = (await ensureSuperadminRole(user));
    // CRITICAL FIX: Do NOT rotate the refresh token secret.
    // Rotating it causes race conditions between the Web App and the Extension.
    // If the Web App refreshes first, the Extension's token becomes invalid, causing logout.
    // We keep the same secret but update the lastUsedAt and expiration.
    // const nextSecret = generateRefreshSecret();
    // session.refreshTokenHash = await bcrypt.hash(nextSecret, 10);
    session.lastUsedAt = new Date();
    session.userAgent = req.get('user-agent') ?? session.userAgent;
    session.ip = req.ip;
    // Extend the session life on use (Rolling Session)
    session.expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    await session.save();
    // Return the SAME refresh token
    // const nextRefreshToken = `${session._id.toString()}.${nextSecret}`;
    const accessToken = await buildAccessToken(user, session._id.toString());
    return { accessToken, refreshToken, session };
};
export const revokeRefreshToken = async (refreshToken) => {
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
export const attachRefreshCookie = (res, refreshToken) => {
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE);
};
export const clearRefreshCookie = (res) => {
    res.clearCookie('refreshToken', REFRESH_COOKIE);
};
export const mapUser = (user) => ({
    id: getUserId(user),
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    timezone: user.timezone,
    role: user.role ?? 'user',
    accountStatus: user.accountStatus ?? 'active',
    tracking: user.tracking,
    presence: user.presence,
    contact: user.contact,
    habits: user.habits,
    createdAt: user.createdAt
});
export const serializeAuthResponse = (user, bundle) => ({
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
