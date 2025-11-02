import { z } from 'zod';
import * as insightService from '../services/insight.service.js';
const generateSchema = z.object({ date: z.string().optional(), regenerate: z.boolean().optional() });
export const getInsights = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const insights = await insightService.getLatest(req.user.sub);
    res.json({ insights });
};
export const generateInsightOnDemand = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const parse = generateSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ error: parse.error.flatten() });
    }
    const insight = await insightService.generateInsight(req.user.sub, parse.data.date, parse.data.regenerate);
    res.status(201).json({ insight });
};
