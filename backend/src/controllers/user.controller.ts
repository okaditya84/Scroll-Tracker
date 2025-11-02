import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.js';
import User from '../models/User.js';
import { mapUser } from '../services/auth.service.js';

const profileSchema = z.object({
  displayName: z.string().min(2).optional(),
  timezone: z.string().optional(),
  avatarUrl: z.string().url().optional()
});

const preferencesSchema = z.object({
  dailyGoalMinutes: z.number().int().min(10).max(480).optional(),
  notificationsEnabled: z.boolean().optional()
});

export const getProfile = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await User.findById(req.user.sub);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user: mapUser(user) });
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parse = profileSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }

  const user = await User.findByIdAndUpdate(req.user.sub, parse.data, { new: true });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user: mapUser(user) });
};

export const getPreferences = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await User.findById(req.user.sub);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ habits: user.habits });
};

export const updatePreferences = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parse = preferencesSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }

  const user = await User.findById(req.user.sub);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.habits = { ...user.habits, ...parse.data };
  await user.save();

  res.json({ habits: user.habits });
};
