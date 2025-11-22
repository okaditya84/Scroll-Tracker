import User from '../models/User.js';
import { z } from 'zod';
const settingsSchema = z.object({
    blocklist: z.array(z.string()).optional(),
    strictMode: z.boolean().optional(),
    dailyGoalMinutes: z.number().optional()
});
export const updateSettings = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const parse = settingsSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ error: parse.error.flatten() });
    }
    try {
        const user = await User.findById(req.user.sub);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        user.focusSettings = { ...user.focusSettings, ...parse.data };
        await user.save();
        res.json({ settings: user.focusSettings });
    }
    catch (error) {
        console.error('Focus Settings Error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
};
export const startSession = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const user = await User.findById(req.user.sub);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Logic to ensure no overlapping sessions could be added here
        const session = {
            startTime: new Date(),
            success: false, // pending
            interruptionCount: 0
        };
        user.focusSessions = user.focusSessions || [];
        user.focusSessions.push(session);
        await user.save();
        res.json({ session });
    }
    catch (error) {
        console.error('Start Session Error:', error);
        res.status(500).json({ error: 'Failed to start session' });
    }
};
export const endSession = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { success, interruptionCount } = req.body;
    try {
        const user = await User.findById(req.user.sub);
        if (!user || !user.focusSessions || user.focusSessions.length === 0) {
            return res.status(404).json({ error: 'No active session found' });
        }
        const lastSession = user.focusSessions[user.focusSessions.length - 1];
        if (lastSession.endTime) {
            return res.status(400).json({ error: 'Last session already ended' });
        }
        lastSession.endTime = new Date();
        lastSession.durationMinutes = (lastSession.endTime.getTime() - lastSession.startTime.getTime()) / 60000;
        lastSession.success = success;
        lastSession.interruptionCount = interruptionCount || 0;
        await user.save();
        res.json({ session: lastSession });
    }
    catch (error) {
        console.error('End Session Error:', error);
        res.status(500).json({ error: 'Failed to end session' });
    }
};
