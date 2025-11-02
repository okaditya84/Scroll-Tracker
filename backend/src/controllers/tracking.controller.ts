import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.js';
import * as trackingService from '../services/tracking.service.js';

const eventSchema = z.object({
  type: z.enum(['scroll', 'click', 'idle', 'focus', 'blur']),
  durationMs: z.number().int().nonnegative().optional(),
  scrollDistance: z.number().nonnegative().optional(),
  url: z.string().url(),
  domain: z.string(),
  startedAt: z.coerce.date().optional(),
  metadata: z.record(z.any()).optional()
});

const bulkSchema = z.object({ events: z.array(eventSchema).min(1) });

export const recordEvents = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parse = bulkSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }

  await trackingService.recordEvents(req.user.sub, parse.data.events);
  res.status(201).json({ stored: parse.data.events.length });
};

export const getSummary = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const summary = await trackingService.getSummary(req.user.sub);
  res.json(summary);
};

export const getTimeline = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const timeline = await trackingService.getTimeline(req.user.sub);
  res.json({ timeline });
};

export const getStreaks = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const streaks = await trackingService.getStreaks(req.user.sub);
  res.json(streaks);
};
