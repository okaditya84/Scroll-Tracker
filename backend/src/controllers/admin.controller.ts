import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import TrackingEvent from '../models/TrackingEvent.js';
import DailyMetric from '../models/DailyMetric.js';
import Insight from '../models/Insight.js';
import Audit from '../models/Audit.js';
import logger from '../utils/logger.js';

const parsePager = (req: Request) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(10, Number(req.query.limit) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const listUsers = async (req: Request, res: Response) => {
  const { limit, skip, page } = parsePager(req);
  const query: any = {};
  if (req.query.q) {
    const q = String(req.query.q).toLowerCase();
    query.$or = [{ email: { $regex: q, $options: 'i' } }, { displayName: { $regex: q, $options: 'i' } }];
  }
  const [items, total] = await Promise.all([User.find(query).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), User.countDocuments(query)]);
  res.json({ page, limit, total, items });
};

export const listEvents = async (req: Request, res: Response) => {
  const { limit, skip, page } = parsePager(req);
  const filter: any = {};
  if (req.query.userId) filter.userId = req.query.userId;
  if (req.query.domain) filter.domain = String(req.query.domain);
  const items = await TrackingEvent.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  const total = await TrackingEvent.countDocuments(filter);
  res.json({ page, limit, total, items });
};

export const exportEventsCsv = async (req: Request, res: Response) => {
  try {
    const filter: any = {};
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.domain) filter.domain = String(req.query.domain);

    const items = await TrackingEvent.find(filter).sort({ createdAt: -1 }).lean();

    const header = ['_id', 'userId', 'type', 'durationMs', 'scrollDistance', 'url', 'domain', 'startedAt', 'createdAt'];
    const rows = items.map((it: any) => [
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
        actorEmail: (req as any).user?.email ?? 'admin',
        action: 'export_events_csv',
        targetType: 'tracking_event',
        meta: { count: items.length }
      });
    } catch (e) {
      logger.warn({ err: e }, 'Failed to write audit for export');
    }
    res.end();
  } catch (error) {
    logger.error({ error }, 'Export events failed');
    res.status(500).json({ error: 'Export failed' });
  }
};

export const listMetrics = async (req: Request, res: Response) => {
  const { limit, skip, page } = parsePager(req);
  const filter: any = {};
  if (req.query.userId) filter.userId = req.query.userId;
  const items = await DailyMetric.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean();
  const total = await DailyMetric.countDocuments(filter);
  res.json({ page, limit, total, items });
};

export const listInsights = async (req: Request, res: Response) => {
  const { limit, skip, page } = parsePager(req);
  const filter: any = {};
  if (req.query.userId) filter.userId = req.query.userId;
  const items = await Insight.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  const total = await Insight.countDocuments(filter);
  res.json({ page, limit, total, items });
};

export const summary = async (_req: Request, res: Response) => {
  const [users, events, metrics, insights] = await Promise.all([
    User.countDocuments(),
    TrackingEvent.countDocuments(),
    DailyMetric.countDocuments(),
    Insight.countDocuments()
  ]);
  res.json({ users, events, metrics, insights });
};

export const promoteUser = async (req: Request, res: Response) => {
  const id = req.params.id;
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.role = 'admin';
  await user.save();
  await Audit.create({ actorEmail: (req as any).user?.email ?? 'admin', action: 'promote_user', targetType: 'user', targetId: id });
  res.json({ ok: true, user: { id: user._id.toString(), email: user.email, role: user.role } });
};

export const demoteUser = async (req: Request, res: Response) => {
  const id = req.params.id;
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.role = 'user';
  await user.save();
  await Audit.create({ actorEmail: (req as any).user?.email ?? 'admin', action: 'demote_user', targetType: 'user', targetId: id });
  res.json({ ok: true, user: { id: user._id.toString(), email: user.email, role: user.role } });
};

export const deleteUser = async (req: Request, res: Response) => {
  const id = req.params.id;
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await Promise.all([User.deleteOne({ _id: id }), TrackingEvent.deleteMany({ userId: id }), DailyMetric.deleteMany({ userId: id }), Insight.deleteMany({ userId: id })]);
  await Audit.create({ actorEmail: (req as any).user?.email ?? 'admin', action: 'delete_user', targetType: 'user', targetId: id });
  res.json({ ok: true });
};

export const getUserDetail = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  const user = await User.findById(id).select('-passwordHash').lean();
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const [metrics, events, insights, audits] = await Promise.all([
    DailyMetric.find({ userId: id }).sort({ date: -1 }).limit(14).lean(),
    TrackingEvent.find({ userId: id }).sort({ createdAt: -1 }).limit(40).lean(),
    Insight.find({ userId: id }).sort({ createdAt: -1 }).limit(5).lean(),
    Audit.find({ targetId: id }).sort({ createdAt: -1 }).limit(10).lean()
  ]);

  res.json({ user, metrics, recentEvents: events, insights, audits });
};

export const updateTrackingStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { paused, reason } = req.body ?? {};
  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const nextPaused = Boolean(paused);
  user.tracking = {
    paused: nextPaused,
    pausedAt: nextPaused ? new Date() : undefined,
    reason: nextPaused ? reason?.slice(0, 512) : undefined
  };
  await user.save();

  await Audit.create({
    actorEmail: (req as any).user?.email ?? 'admin',
    action: nextPaused ? 'tracking_paused' : 'tracking_resumed',
    targetType: 'user',
    targetId: id,
    meta: { reason }
  });

  res.json({ ok: true, tracking: user.tracking });
};

export const liveActivity = async (req: Request, res: Response) => {
  const windowMs = Math.min(30 * 60 * 1000, Math.max(60 * 1000, Number(req.query.windowMs) || 5 * 60 * 1000));
  const since = new Date(Date.now() - windowMs);

  const latestEvents = await TrackingEvent.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$userId',
        lastEvent: { $first: '$$ROOT' },
        count: { $sum: 1 },
        domains: { $push: '$domain' },
        types: { $push: '$type' }
      }
    },
    { $limit: 400 }
  ]);

  const userIds = latestEvents.map(item => item._id).filter(Boolean);
  const users = await User.find({ _id: { $in: userIds } })
    .select('displayName email avatarUrl role timezone tracking presence contact accountStatus')
    .lean();
  const userMap = new Map(users.map(u => [u._id?.toString(), u]));

  const eventsByUser = await TrackingEvent.find({ userId: { $in: userIds }, createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .limit(1000)
    .lean();
  const recentMap = new Map<string, any[]>();
  eventsByUser.forEach(event => {
    const key = event.userId.toString();
    const bucket = recentMap.get(key) ?? [];
    if (bucket.length < 5) {
      bucket.push(event);
      recentMap.set(key, bucket);
    }
  });

  const items = latestEvents.map(group => {
    const key = group._id?.toString();
    const user = key ? userMap.get(key) : undefined;
    const last = group.lastEvent;
    const status = (() => {
      const lastEventAt = last?.createdAt ? new Date(last.createdAt) : undefined;
      if (!lastEventAt) return 'offline';
      const diff = Date.now() - lastEventAt.getTime();
      if (diff <= 90_000) return 'active';
      if (diff <= 10 * 60 * 1000) return 'recent';
      return 'idle';
    })();

    const typeCounts = (Array.isArray(group.types) ? (group.types as string[]) : []).reduce(
      (acc, type) => {
        if (!type) return acc;
        acc[type] = (acc[type] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const domainCounts = (Array.isArray(group.domains) ? (group.domains as string[]) : []).reduce(
      (acc, domain) => {
        if (!domain) return acc;
        const keyDomain = domain.toLowerCase();
        acc[keyDomain] = (acc[keyDomain] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const topDomainEntry = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 1)[0];

    return {
      user: user
        ? {
            id: user._id?.toString(),
            email: user.email,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            role: user.role,
            timezone: user.timezone,
            tracking: user.tracking,
            presence: user.presence,
            contact: user.contact,
            accountStatus: user.accountStatus
          }
        : undefined,
      lastEvent: last,
      status,
      windowCount: group.count,
      typeCounts,
      topDomain: topDomainEntry ? topDomainEntry[0] : undefined,
      recentEvents: key ? recentMap.get(key) ?? [] : []
    };
  });

  res.json({ windowMs, updatedAt: new Date(), items });
};
