import { z } from 'zod';
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
export const getProfile = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await User.findById(req.user.sub);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json(mapUser(user));
};
export const updateProfile = async (req, res) => {
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
    res.json(mapUser(user));
};
export const getPreferences = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await User.findById(req.user.sub);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json({ habits: user.habits });
};
export const updatePreferences = async (req, res) => {
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
export const deleteAccount = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = req.user.sub;
    // Remove user and associated data
    await Promise.all([
        User.findByIdAndDelete(userId),
        // models imported dynamically to avoid circular deps in some setups
        (await import('../models/TrackingEvent.js')).default.deleteMany({ userId }),
        (await import('../models/Insight.js')).default.deleteMany({ userId }),
        (await import('../models/DailyMetric.js')).default.deleteMany({ userId }),
        (await import('../models/Session.js')).default.deleteMany({ userId })
    ]).catch(error => {
        // log but don't expose internals
        // eslint-disable-next-line no-console
        console.error('deleteAccount error', error);
    });
    res.json({ ok: true });
};
