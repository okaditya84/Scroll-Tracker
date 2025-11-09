import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import env from '../config/env.js';
import User from '../models/User.js';
import * as authService from '../services/auth.service.js';
import logger from '../utils/logger.js';
const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    displayName: z.string().min(2),
    timezone: z.string().optional()
});
export const register = async (req, res) => {
    const parse = registerSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ error: parse.error.flatten() });
    }
    const { email, password, displayName, timezone } = parse.data;
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
        return res.status(409).json({ error: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email: email.toLowerCase(), passwordHash, displayName, timezone });
    const sessionBundle = await authService.createSession(user, req);
    authService.attachRefreshCookie(res, sessionBundle.refreshToken);
    res.status(201).json(authService.serializeAuthResponse(user, sessionBundle));
};
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
});
export const login = async (req, res) => {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ error: parse.error.flatten() });
    }
    const { email, password } = parse.data;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.passwordHash) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const sessionBundle = await authService.createSession(user, req);
    authService.attachRefreshCookie(res, sessionBundle.refreshToken);
    res.json(authService.serializeAuthResponse(user, sessionBundle));
};
const refreshSchema = z.object({
    refreshToken: z.string().min(32)
});
export const refresh = async (req, res) => {
    const candidate = req.body.refreshToken ?? req.cookies?.refreshToken;
    const parse = refreshSchema.safeParse({ refreshToken: candidate });
    if (!parse.success) {
        return res.status(400).json({ error: 'Invalid refresh token' });
    }
    try {
        const bundle = await authService.refreshTokens(parse.data.refreshToken, req);
        authService.attachRefreshCookie(res, bundle.refreshToken);
        res.json({
            tokens: {
                accessToken: bundle.accessToken,
                refreshToken: bundle.refreshToken
            },
            session: {
                id: bundle.session.id,
                expiresAt: bundle.session.expiresAt
            }
        });
    }
    catch (error) {
        logger.warn({ error }, 'Refresh denied');
        // clear any refresh cookie and require re-authentication
        try {
            authService.clearRefreshCookie(res);
        }
        catch { }
        res.status(401).json({ error: 'Re-authentication required' });
    }
};
export const logout = async (req, res) => {
    const token = req.body.refreshToken ?? req.cookies?.refreshToken;
    if (token) {
        await authService.revokeRefreshToken(token);
    }
    authService.clearRefreshCookie(res);
    res.status(204).send();
};
const googleSchema = z.object({ idToken: z.string() });
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
export const googleSignIn = async (req, res) => {
    const parse = googleSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ error: 'Invalid id token' });
    }
    const ticket = await googleClient.verifyIdToken({
        idToken: parse.data.idToken,
        audience: env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
        return res.status(401).json({ error: 'Google verification failed' });
    }
    const email = payload.email.toLowerCase();
    const displayName = payload.name ?? email.split('@')[0];
    const avatarUrl = payload.picture;
    let user = await User.findOne({ email });
    if (!user) {
        user = await User.create({
            email,
            googleId: payload.sub,
            displayName,
            avatarUrl,
            timezone: payload.locale
        });
    }
    else if (!user.googleId) {
        user.googleId = payload.sub;
        if (avatarUrl) {
            user.avatarUrl = avatarUrl;
        }
        await user.save();
    }
    const bundle = await authService.createSession(user, req);
    authService.attachRefreshCookie(res, bundle.refreshToken);
    res.json(authService.serializeAuthResponse(user, bundle));
};
