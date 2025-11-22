import TrackingEvent from '../models/TrackingEvent.js';
import User from '../models/User.js';
export const getDashboardStats = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = req.user.sub;
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(now.setDate(now.getDate() - 7));
    try {
        // 1. Most Visited Domains (Last 7 Days)
        const mostVisited = await TrackingEvent.aggregate([
            { $match: { userId: userId, createdAt: { $gte: startOfWeek } } },
            { $group: { _id: '$domain', visitCount: { $sum: 1 }, totalDuration: { $sum: '$durationMs' } } },
            { $sort: { visitCount: -1 } },
            { $limit: 10 }
        ]);
        // 2. Activity Heatmap (Hour of Day)
        const activityHeatmap = await TrackingEvent.aggregate([
            { $match: { userId: userId, createdAt: { $gte: startOfWeek } } },
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
            { $match: { userId: userId, type: 'scroll', createdAt: { $gte: startOfWeek } } },
            {
                $group: {
                    _id: null,
                    avgSpeed: { $avg: '$scrollSpeed' },
                    maxSpeed: { $max: '$scrollSpeed' },
                    totalDistance: { $sum: '$scrollDistance' }
                }
            }
        ]);
        // 4. Doom Scroll Candidates (Long duration, passive interaction)
        const doomScrolls = await TrackingEvent.find({
            userId: userId,
            createdAt: { $gte: startOfWeek },
            durationMs: { $gt: 300000 }, // > 5 mins
            interactionType: 'passive'
        })
            .select('domain url durationMs createdAt')
            .sort({ durationMs: -1 })
            .limit(5);
        res.json({
            mostVisited,
            activityHeatmap,
            scrollStats: scrollStats[0] || { avgSpeed: 0, maxSpeed: 0, totalDistance: 0 },
            doomScrolls
        });
    }
    catch (error) {
        console.error('Analytics Error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
};
export const getFocusStats = async (req, res) => {
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
        res.json({
            totalMinutes,
            sessionCount: sessions.length,
            successRate: sessions.length ? (successCount / sessions.length) * 100 : 0,
            history: sessions.slice(-10).reverse(), // Last 10 sessions
            settings: user.focusSettings
        });
    }
    catch (error) {
        console.error('Focus Stats Error:', error);
        res.status(500).json({ error: 'Failed to fetch focus stats' });
    }
};
