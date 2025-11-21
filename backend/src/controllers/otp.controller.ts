import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import User from '../models/User.js';
import Audit from '../models/Audit.js';
import * as authService from '../services/auth.service.js';
import { issueOtp, verifyOtp } from '../services/otp.service.js';

const signupRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2),
  timezone: z.string().optional()
});

const signupVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().min(4)
});

const passwordRequestSchema = z.object({
  email: z.string().email()
});

const passwordResetSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4),
  password: z.string().min(8)
});

const buildContext = (req: Request) => ({ ip: req.ip, userAgent: req.get('user-agent') ?? 'unknown' });

export const requestSignupOtp = async (req: Request, res: Response) => {
  const parse = signupRequestSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }

  const { email, password, displayName, timezone } = parse.data;
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const payload = await issueOtp({
    email,
    purpose: 'signup',
    metadata: { passwordHash, displayName, timezone },
    context: buildContext(req)
  });

  await Audit.create({
    actorEmail: email.toLowerCase(),
    action: 'otp_signup_requested',
    targetType: 'user',
    targetId: email.toLowerCase(),
    meta: { expiresAt: payload.expiresAt }
  });

  res.json({ message: 'OTP sent to your email address', expiresAt: payload.expiresAt });
};

export const verifySignupOtp = async (req: Request, res: Response) => {
  const parse = signupVerifySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }

  const { email, code } = parse.data;
  const result = await verifyOtp({ email, purpose: 'signup', code });
  const metadata = (result.metadata ?? {}) as Record<string, any>;
  const passwordHash = metadata.passwordHash as string | undefined;
  const displayName = metadata.displayName as string | undefined;
  const timezone = metadata.timezone as string | undefined;

  if (!passwordHash || !displayName) {
    return res.status(400).json({ error: 'Signup request is incomplete. Please restart the flow.' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const user = await User.create({
    email: email.toLowerCase(),
    passwordHash,
    displayName,
    timezone
  });

  await Audit.create({
    actorId: user._id,
    actorEmail: user.email,
    action: 'otp_signup_verified',
    targetType: 'user',
    targetId: user._id.toString()
  });

  const sessionBundle = await authService.createSession(user, req);
  authService.attachRefreshCookie(res, sessionBundle.refreshToken);
  res.status(201).json(authService.serializeAuthResponse(user, sessionBundle));
};

export const requestPasswordResetOtp = async (req: Request, res: Response) => {
  const parse = passwordRequestSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }

  const { email } = parse.data;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(200).json({ message: 'If an account exists, an OTP has been sent.' });
  }

  await issueOtp({ email, purpose: 'password_reset', metadata: { userId: user._id.toString() }, context: buildContext(req) });
  await Audit.create({
    actorEmail: email.toLowerCase(),
    action: 'otp_password_requested',
    targetType: 'user',
    targetId: user._id.toString()
  });

  res.json({ message: 'If an account exists, an OTP has been sent.' });
};

export const verifyPasswordReset = async (req: Request, res: Response) => {
  const parse = passwordResetSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }

  const { email, code, password } = parse.data;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(404).json({ error: 'Account not found' });
  }

  await verifyOtp({ email, purpose: 'password_reset', code });

  user.passwordHash = await bcrypt.hash(password, 12);
  await user.save();

  await Audit.create({
    actorId: user._id,
    actorEmail: user.email,
    action: 'otp_password_reset',
    targetType: 'user',
    targetId: user._id.toString()
  });

  const sessionBundle = await authService.createSession(user, req);
  authService.attachRefreshCookie(res, sessionBundle.refreshToken);
  res.json(authService.serializeAuthResponse(user, sessionBundle));
};
