import User from '../models/User.js';
import TrackingEvent from '../models/TrackingEvent.js';
import DailyMetric from '../models/DailyMetric.js';
import Insight from '../models/Insight.js';
import Audit from '../models/Audit.js';
import logger from '../utils/logger.js';
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
export const exportEventsCsv = async (req, res) => {
    try {
        const filter = {};
        if (req.query.userId)
            filter.userId = req.query.userId;
        if (req.query.domain)
            filter.domain = String(req.query.domain);
        const items = await TrackingEvent.find(filter).sort({ createdAt: -1 }).lean();
        const header = ['_id', 'userId', 'type', 'durationMs', 'scrollDistance', 'url', 'domain', 'startedAt', 'createdAt'];
        const rows = items.map((it) => [
            it._id?.toString?.() ?? '',
            it.userId?.toString?.() ?? '',
            it.type ?? '',
            it.durationMs ?? '',
            it.scrollDistance ?? '',
            (it.url ?? '').replace(/"/g, '""'),
            it.domain ?? '',
            it.startedAt ? new Date(it.startedAt).toISOString() : '',
            it.createdAt ? new Date(it.createdAt).toISOString() : ''
        ]);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="events.csv"`);
        res.write(header.join(',') + '\n');
        for (const row of rows) {
            // Quote url field if necessary
            const quoted = row.map(v => (typeof v === 'string' && v.includes(',') ? `"${v}"` : `${v}`));
            res.write(quoted.join(',') + '\n');
        }
        // log export action
        try {
            await Audit.create({
                actorEmail: req.user?.email ?? 'admin',
                action: 'export_events_csv',
                targetType: 'tracking_event',
                meta: { count: items.length }
            });
        }
        catch (e) {
            logger.warn({ err: e }, 'Failed to write audit for export');
        }
        res.end();
    }
    catch (error) {
        logger.error({ error }, 'Export events failed');
        res.status(500).json({ error: 'Export failed' });
    }
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
export const promoteUser = async (req, res) => {
    const id = req.params.id;
    const user = await User.findById(id);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    user.role = 'admin';
    await user.save();
    await Audit.create({ actorEmail: req.user?.email ?? 'admin', action: 'promote_user', targetType: 'user', targetId: id });
    res.json({ ok: true, user: { id: user._id.toString(), email: user.email, role: user.role } });
};
export const demoteUser = async (req, res) => {
    const id = req.params.id;
    const user = await User.findById(id);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    user.role = 'user';
    await user.save();
    await Audit.create({ actorEmail: req.user?.email ?? 'admin', action: 'demote_user', targetType: 'user', targetId: id });
    res.json({ ok: true, user: { id: user._id.toString(), email: user.email, role: user.role } });
};
export const deleteUser = async (req, res) => {
    const id = req.params.id;
    const user = await User.findById(id);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    await Promise.all([User.deleteOne({ _id: id }), TrackingEvent.deleteMany({ userId: id }), DailyMetric.deleteMany({ userId: id }), Insight.deleteMany({ userId: id })]);
    await Audit.create({ actorEmail: req.user?.email ?? 'admin', action: 'delete_user', targetType: 'user', targetId: id });
    res.json({ ok: true });
};
