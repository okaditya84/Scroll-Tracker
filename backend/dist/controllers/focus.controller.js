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
    const { durationMinutes } = req.body;
    try {
        const user = await User.findById(req.user.sub);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Check if there's already an active session
        const activeSession = user.focusSessions?.find(s => !s.endTime);
        if (activeSession) {
            return res.status(400).json({ error: 'Session already active' });
        }
        const sessionDuration = durationMinutes || user.focusSettings?.dailyGoalMinutes || 25;
        const session = {
            startTime: new Date(),
            durationMinutes: sessionDuration,
            success: false, // pending
            interruptionCount: 0
        };
        user.focusSessions = user.focusSessions || [];
        user.focusSessions.push(session);
        await user.save();
        console.log(`[Focus] Started session for user ${user.email}. Duration: ${sessionDuration}m`);
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
        // Strict Mode Check
        if (user.focusSettings?.strictMode) {
            const now = new Date();
            const endTime = new Date(lastSession.startTime.getTime() + (lastSession.durationMinutes || 25) * 60000);
            if (now < endTime) {
                console.log(`[Focus] Strict mode prevented early exit for user ${user.email}`);
                return res.status(403).json({
                    error: 'Strict mode active. You cannot end the session early.',
                    remainingMinutes: Math.ceil((endTime.getTime() - now.getTime()) / 60000)
                });
            }
        }
        lastSession.endTime = new Date();
        // Recalculate actual duration if needed, or keep the planned duration? 
        // Usually we want to know how long they actually stayed.
        // But for success/failure, we compare against planned.
        // Let's store actual duration in a separate field if we had one, but for now we can just update endTime.
        lastSession.success = success ?? true; // Default to true if manually ended (and allowed)
        lastSession.interruptionCount = interruptionCount || 0;
        await user.save();
        console.log(`[Focus] Ended session for user ${user.email}. Success: ${lastSession.success}`);
        res.json({ session: lastSession });
    }
    catch (error) {
        console.error('End Session Error:', error);
        res.status(500).json({ error: 'Failed to end session' });
    }
};
