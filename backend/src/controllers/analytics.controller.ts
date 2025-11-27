import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import TrackingEvent from '../models/TrackingEvent.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.sub;
    const now = new Date();
    // Clone dates to avoid mutation side-effects
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    try {
        // 1. Most Visited Domains (Last 7 Days)
        const mostVisited = await TrackingEvent.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: startOfWeek } } },
            { $group: { _id: '$domain', visitCount: { $sum: 1 }, totalDuration: { $sum: '$durationMs' } } },
            { $sort: { visitCount: -1 } },
            { $limit: 10 }
        ]);

        // 2. Activity Heatmap (Hour of Day)
        const activityHeatmap = await TrackingEvent.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: startOfWeek } } },
            {
                $project: {
                    hour: { $hour: '$createdAt' },
                    dayOfWeek: { $dayOfWeek: '$createdAt' }
                }
            },
            { $group: { _id: { hour: '$hour', day: '$dayOfWeek' }, count: { $sum: 1 } } },
            { $sort: { '_id.day': 1, '_id.hour': 1 } }
        ]);

        // 3. Average Scroll Speed & Doom Scroll Detection
        const scrollStats = await TrackingEvent.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId), type: 'scroll', createdAt: { $gte: startOfWeek } } },
            {
                $group: {
                    _id: null,
                    avgSpeed: { $avg: '$scrollSpeed' },
                    maxSpeed: { $max: '$scrollSpeed' },
                    totalDistance: { $sum: '$scrollDistance' }
                }
            }
        ]);

        // 4. Doom Scroll Candidates (High duration on passive sites today)
        // Aggregating by domain to find total time spent, rather than single long events
        const doomScrolls = await TrackingEvent.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    createdAt: { $gte: startOfDay },
                    interactionType: { $ne: 'active' } // Default to passive if not specified
                }
            },
            {
                $group: {
                    _id: '$domain',
                    totalDuration: { $sum: '$durationMs' },
                    visitCount: { $sum: 1 }
                }
            },
            { $match: { totalDuration: { $gt: 5 * 60 * 1000 } } }, // > 5 mins total today
            { $sort: { totalDuration: -1 } },
            { $limit: 5 },
            {
                $project: {
                    domain: '$_id',
                    durationMs: '$totalDuration',
                    visitCount: 1,
                    _id: 0
                }
            }
        ]);

        res.json({
            mostVisited,
            activityHeatmap,
            scrollStats: scrollStats[0] || { avgSpeed: 0, maxSpeed: 0, totalDistance: 0 },
            doomScrolls
        });
    } catch (error) {
        console.error('Analytics Error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
};

export const getFocusStats = async (req: AuthRequest, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const user = await User.findById(req.user.sub).select('focusSessions focusSettings');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const sessions = user.focusSessions || [];
        const totalMinutes = sessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
        const successCount = sessions.filter(s => s.success).length;

        // Calculate usage on blocklisted domains for today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const blocklist = user.focusSettings?.blocklist || [];
        let usageMinutes = 0;

        if (blocklist.length > 0) {
            const usageStats = await TrackingEvent.aggregate([
                {
                    $match: {
                        userId: new mongoose.Types.ObjectId(req.user.sub),
                        createdAt: { $gte: startOfDay },
                        domain: { $in: blocklist } // Match any domain in blocklist
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalDurationMs: { $sum: '$durationMs' }
                    }
                }
            ]);
            if (usageStats.length > 0) {
                usageMinutes = Math.ceil(usageStats[0].totalDurationMs / 60000);
            }
        }

        res.json({
            totalMinutes,
            sessionCount: sessions.length,
            successRate: sessions.length ? (successCount / sessions.length) * 100 : 0,
            history: sessions.slice(-10).reverse(), // Last 10 sessions
            settings: user.focusSettings,
            usageMinutes // New field: Time spent on blocked sites today
        });
    } catch (error) {
        console.error('Focus Stats Error:', error);
        res.status(500).json({ error: 'Failed to fetch focus stats' });
    }
};
