import cron from 'node-cron';
import { Types } from 'mongoose';
import TrackingEvent from '../models/TrackingEvent.js';
import Insight from '../models/Insight.js';
import logger from '../utils/logger.js';
import { aggregateDailyMetrics } from '../services/tracking.service.js';
import { generateInsight } from '../services/insight.service.js';

const registerJobs = () => {
  cron.schedule('15 * * * *', async () => {
    try {
      const since = new Date(Date.now() - 12 * 60 * 60 * 1000);
      const rawIds = (await TrackingEvent.distinct('userId', {
        createdAt: { $gte: since }
      })) as unknown[];
      const date = new Date().toISOString().slice(0, 10);
      await Promise.all(
        rawIds.map(userId =>
          aggregateDailyMetrics(userId instanceof Types.ObjectId ? userId.toString() : String(userId), date)
        )
      );
      logger.debug('Aggregated metrics for active users');
    } catch (error) {
      logger.error({ error }, 'Failed to aggregate metrics');
    }
  });

  cron.schedule('*/3 * * * *', async () => {
    try {
      const activitySince = new Date(Date.now() - 15 * 60 * 1000);
      const today = new Date().toISOString().slice(0, 10);
      const rawIds = (await TrackingEvent.distinct('userId', {
        createdAt: { $gte: activitySince }
      })) as unknown[];

      for (const rawId of rawIds) {
        const userId = rawId instanceof Types.ObjectId ? rawId.toString() : String(rawId);
        const latestInsight = await Insight.findOne({ userId }).sort({ createdAt: -1 }).lean();
        if (latestInsight) {
          const ageMs = Date.now() - new Date(latestInsight.createdAt).getTime();
          if (ageMs < 2 * 60 * 1000) {
            continue;
          }
        }

        try {
          await generateInsight(userId, today);
        } catch (error) {
          if (error instanceof Error && /No metrics available/i.test(error.message)) {
            continue;
          }
          logger.warn({ error, userId }, 'Failed to generate scheduled insight');
        }
      }
    } catch (error) {
      logger.error({ error }, 'Failed to schedule insights');
    }
  });
};

export default registerJobs;
