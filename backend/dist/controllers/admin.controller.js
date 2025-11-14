import User from '../models/User.js';
import TrackingEvent from '../models/TrackingEvent.js';
import DailyMetric from '../models/DailyMetric.js';
import Insight from '../models/Insight.js';
const parsePager = (req) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(10, Number(req.query.limit) || 50));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
};
export const listUsers = async (req, res) => {
    const { limit, skip, page } = parsePager(req);
    const query = {};
    if (req.query.q) {
        const q = String(req.query.q).toLowerCase();
        query.$or = [{ email: { $regex: q, $options: 'i' } }, { displayName: { $regex: q, $options: 'i' } }];
    }
    const [items, total] = await Promise.all([User.find(query).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), User.countDocuments(query)]);
    res.json({ page, limit, total, items });
};
export const listEvents = async (req, res) => {
    const { limit, skip, page } = parsePager(req);
    const filter = {};
    if (req.query.userId)
        filter.userId = req.query.userId;
    if (req.query.domain)
        filter.domain = String(req.query.domain);
    const items = await TrackingEvent.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    const total = await TrackingEvent.countDocuments(filter);
    res.json({ page, limit, total, items });
};
export const listMetrics = async (req, res) => {
    const { limit, skip, page } = parsePager(req);
    const filter = {};
    if (req.query.userId)
        filter.userId = req.query.userId;
    const items = await DailyMetric.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean();
    const total = await DailyMetric.countDocuments(filter);
    res.json({ page, limit, total, items });
};
export const listInsights = async (req, res) => {
    const { limit, skip, page } = parsePager(req);
    const filter = {};
    if (req.query.userId)
        filter.userId = req.query.userId;
    const items = await Insight.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    const total = await Insight.countDocuments(filter);
    res.json({ page, limit, total, items });
};
export const summary = async (_req, res) => {
    const [users, events, metrics, insights] = await Promise.all([
        User.countDocuments(),
        TrackingEvent.countDocuments(),
        DailyMetric.countDocuments(),
        Insight.countDocuments()
    ]);
    res.json({ users, events, metrics, insights });
};
