import crypto from 'node:crypto';
import DailyMetric from '../models/DailyMetric.js';
import Insight from '../models/Insight.js';
import { callGroq, type GroqMessage } from '../utils/groqClient.js';
import {
  pixelsToClimbometers,
  pixelsToKilometers,
  formatScrollDistanceWithBoth,
  getScrollDistanceDescription
} from '../utils/scrollConversion.js';
import logger from '../utils/logger.js';

const toMinutes = (valueMs?: number) => Math.round((valueMs ?? 0) / 60000);

type InsightContext = {
  date: string;
  totals: {
    activeMinutes: number;
    idleMinutes: number;
    scrollDistance: number;
    scrollDistanceCm: number;
    scrollDistanceKm: number;
    clickCount: number;
    activeGoalMinutes: number;
  };
  topDomains: Array<{
    domain: string;
    activeMinutes: number;
    sharePercent: number;
    scrollDistance: number;
    scrollDistanceCm: number;
    scrollDistanceKm: number;
  }>;
  peakHours: Array<{
    hour: number;
    activeMinutes: number;
  }>;
  coverage: {
    domainCount: number;
    hourCount: number;
  };
  flags: {
    lowActivity: boolean;
    extendedActivity: boolean;
    highScrollDistance: boolean;
    highClickCount: boolean;
  };
  derived: {
    activeVsGoalMinutes: number;
    scrollPerActiveMinute: number | null;
    scrollPerActiveMinuteCm: number | null;
    clicksPerActiveMinute: number | null;
    activeIdleRatio: number | null;
  };
};

export const getLatest = async (userId: string, limit = 10) => {
  const candidates = await Insight.find({ userId })
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(limit * 3)
    .lean();

  const unique: typeof candidates = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const key = `${candidate.metricDate}:${candidate.metricSignature ?? candidate.title}`;
    if (seen.has(key)) {
      continue;
    }
    unique.push(candidate);
    seen.add(key);
    if (unique.length >= limit) {
      break;
    }
  }

  return unique;
};

export const generateInsight = async (userId: string, metricDate?: string, regenerate = false) => {
  const date = metricDate ?? new Date().toISOString().slice(0, 10);
  const metric = await DailyMetric.findOne({ userId, date });
  if (!metric) {
    throw new Error('No metrics available for insights yet');
  }

  const totalActive = Math.round(metric.totals?.activeMinutes ?? 0);
  const totalIdle = Math.round(metric.totals?.idleMinutes ?? 0);
  const totalScroll = Math.round(metric.totals?.scrollDistance ?? 0);
  const totalClicks = Math.round(metric.totals?.clickCount ?? 0);

  const totalScrollCm = pixelsToClimbometers(totalScroll);
  const totalScrollKm = pixelsToKilometers(totalScroll);

  const topDomains = (metric.breakdown?.domain ?? [])
    .filter(entry => (entry?.durationMs ?? 0) > 0 || (entry?.scrollDistance ?? 0) > 0)
    .slice(0, 5)
    .map(entry => {
      const activeMinutes = toMinutes(entry.durationMs);
      const sharePercent = totalActive > 0 ? Math.round((activeMinutes / totalActive) * 100) : 0;
      const scrollDistance = Math.round(entry.scrollDistance ?? 0);
      return {
        domain: entry.domain,
        activeMinutes,
        sharePercent,
        scrollDistance,
        scrollDistanceCm: pixelsToClimbometers(scrollDistance),
        scrollDistanceKm: pixelsToKilometers(scrollDistance)
      };
    });

  const peakHours = Object.entries(metric.breakdown?.hour ?? {})
    .map(([hour, duration]) => ({
      hour: Number(hour),
      activeMinutes: toMinutes(typeof duration === 'number' ? duration : Number(duration ?? 0))
    }))
    .filter(entry => entry.activeMinutes > 0)
    .sort((a, b) => b.activeMinutes - a.activeMinutes)
    .slice(0, 4);

  const scrollPerActiveMinute = totalActive > 0 ? Math.round(totalScroll / totalActive) : null;
  const scrollPerActiveMinuteCm = totalActive > 0 ? pixelsToClimbometers(scrollPerActiveMinute ?? 0) : null;
  const clicksPerActiveMinute = totalActive > 0 ? Number((totalClicks / totalActive).toFixed(1)) : null;
  const activeVsGoal = totalActive - 120;

  // Analogies Context
  const caloriesBurned = Math.round(totalActive * 1.5); // Approx 1.5 cal/min for desk work
  const everestHeightCm = 884900;
  const burjKhalifaHeightCm = 82800;
  const scrollHeightRatio = totalScrollCm / 170; // Assuming avg human height 170cm

  const context: InsightContext = {
    date,
    totals: {
      activeMinutes: totalActive,
      idleMinutes: totalIdle,
      scrollDistance: totalScroll,
      scrollDistanceCm: Math.round(totalScrollCm * 10) / 10,
      scrollDistanceKm: Math.round(totalScrollKm * 10000) / 10000,
      clickCount: totalClicks,
      activeGoalMinutes: 120
    },
    topDomains,
    peakHours,
    coverage: {
      domainCount: metric.breakdown?.domain?.length ?? 0,
      hourCount: Object.keys(metric.breakdown?.hour ?? {}).length
    },
    flags: {
      lowActivity: totalActive < 10,
      extendedActivity: totalActive > 180,
      highScrollDistance: totalScroll > 90000,
      highClickCount: totalClicks > 250
    },
    derived: {
      activeVsGoalMinutes: activeVsGoal,
      scrollPerActiveMinute,
      scrollPerActiveMinuteCm,
      clicksPerActiveMinute,
      activeIdleRatio:
        totalIdle + totalActive > 0 ? Number(((totalActive / Math.max(totalIdle + totalActive, 1)) * 100).toFixed(1)) : null
    }
  };

  const signature = computeMetricSignature(context);
  const prompt: GroqMessage[] = [
    {
      role: 'system',
      content: `You are Scrollwise, a witty and realistic productivity companion. Your goal is to provide 3 distinct, funny, and realistic analogies based on the user's browsing stats.
      
      **Guidelines:**
      1.  **Physical Analogies:** Compare their scroll distance to real-world objects (e.g., "You scrolled the height of the Eiffel Tower", "You climbed 3 flights of stairs with your thumb"). Use the provided cm/km data.
      2.  **Energy Output:** Mention calories burned (approx ${caloriesBurned} cal) or energy expended (e.g., "You burned enough calories to power a lightbulb for 5 minutes").
      3.  **Time/Focus:** Relate their active time to something tangible (e.g., "You spent enough time online to watch 'The Office' twice").
      
      **Tone:** Humorous, slightly roast-y but encouraging, and VERY realistic. Avoid generic "good job" messages. Make them feel the weight of their digital actions.
      
      **Format:** Return exactly 3 bullet points, each starting with a relevant emoji.`
    },
    {
      role: 'user',
      content: `Stats:
      - Active Time: ${totalActive} min (approx ${caloriesBurned} calories burned)
      - Scroll Distance: ${totalScroll} px (${totalScrollCm.toFixed(1)} cm / ${totalScrollKm.toFixed(3)} km)
      - Clicks: ${totalClicks}
      - Top Sites: ${topDomains.map(d => d.domain).join(', ')}
      
      Context:
      - Scrolled approx ${(totalScrollCm / burjKhalifaHeightCm).toFixed(4)}x Burj Khalifas.
      - Scrolled approx ${scrollHeightRatio.toFixed(1)}x human heights.
      
      Give me 3 funny, realistic insights.`
    }
  ];

  const MAX_ATTEMPTS = 3;
  let sanitized = '';
  let completion = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    completion = await callGroq(prompt);
    sanitized = (sanitizeCompletion(completion) || completion).trim();
    if (sanitized) {
      break;
    }
    logger.warn({ attempt }, 'LLM returned empty insight content, retrying');
  }

  if (!sanitized) {
    logger.error({ completion }, 'LLM failed to generate insight content, using local fallback');
    // Fallback: generate three concise, informative bullets locally so users still get helpful notes
    sanitized = generateLocalFallback(context);
  }
  const payload = {
    userId,
    title: deriveTitle(sanitized),
    body: sanitized,
    metricDate: date,
    tags: deriveTags(metric),
    metricSignature: signature
  };

  const latest = await Insight.findOne({ userId, metricDate: date })
    .sort({ updatedAt: -1, createdAt: -1 })
    .exec();

  if (latest && latest.metricSignature === signature) {
    latest.title = payload.title;
    latest.body = payload.body;
    latest.tags = payload.tags;
    latest.metricSignature = signature;
    latest.set('updatedAt', new Date());
    await latest.save();
    await trimDailyInsights(userId, date, 10);
    return latest;
  }

  const insight = await Insight.create(payload);
  await trimDailyInsights(userId, date, 10);
  return insight;
};

const deriveTitle = (text: string) => {
  const firstLine = text.split('\n').find(line => line.trim().length > 0) ?? 'Scroll update';
  return firstLine.length > 70 ? `${firstLine.slice(0, 67)}...` : firstLine;
};

const deriveTags = (metric: any) => {
  const tags: string[] = [];
  if ((metric.totals?.activeMinutes ?? 0) > 240) tags.push('marathon');
  if ((metric.totals?.scrollDistance ?? 0) > 5000) tags.push('deep-dive');
  if ((metric.totals?.idleMinutes ?? 0) < 30) tags.push('laser-focus');
  return tags;
};

const computeMetricSignature = (context: InsightContext) => {
  const significant = {
    date: context.date,
    totals: context.totals,
    topDomains: context.topDomains.map(entry => ({
      domain: entry.domain,
      activeMinutes: entry.activeMinutes,
      sharePercent: entry.sharePercent,
      scrollDistance: entry.scrollDistance,
      scrollDistanceCm: entry.scrollDistanceCm,
      scrollDistanceKm: entry.scrollDistanceKm
    })),
    peakHours: context.peakHours,
    derived: context.derived
  };

  return crypto.createHash('sha256').update(JSON.stringify(significant)).digest('hex');
};

const sanitizeCompletion = (text: string) => {
  const lines = text
    .split('\n')
    .map(line => line.replace(/\s+$/u, ''));

  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      if (deduped.length === 0 || deduped[deduped.length - 1] === '') {
        continue;
      }
      deduped.push('');
      continue;
    }

    const normalized = trimmed.replace(/^[-*•]\s*/u, '').toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(rawLine.replace(/^\s+/u, ''));
  }

  return deduped.join('\n').replace(/\n{3,}/gu, '\n\n').trim();
};

const generateLocalFallback = (context: InsightContext) => {
  const lines: string[] = [];
  const t = context.totals;
  // Movement/distance analogy
  lines.push(`📏 You scrolled ${t.scrollDistanceCm} cm (${t.scrollDistance} px) — about ${t.scrollDistanceKm >= 0.1 ? `${t.scrollDistanceKm.toFixed(2)} km` : `${t.scrollDistanceCm} cm`} of content.`);
  // Productivity/output analogy
  if (context.derived.clicksPerActiveMinute != null) {
    lines.push(`⚙️ You averaged ${context.derived.clicksPerActiveMinute} clicks per active minute — a steady output indicator.`);
  } else {
    lines.push(`⚙️ Clicks and activity show modest interaction today.`);
  }
  // Wellbeing/pacing analogy
  const active = t.activeMinutes;
  if (active < 30) {
    lines.push(`🌿 Light day: ${active} active minutes — short, focused bursts. A brief walk would balance energy.`);
  } else if (active <= 180) {
    lines.push(`⏱️ Good rhythm: ${active} active minutes. Keep short breaks to sustain focus.`);
  } else {
    lines.push(`🏃 Long session: ${active} active minutes — consider a longer break to recharge.`);
  }

  return lines.join('\n');
};

const trimDailyInsights = async (userId: string, date: string, keep: number) => {
  const extras = await Insight.find({ userId, metricDate: date })
    .sort({ updatedAt: -1, createdAt: -1 })
    .skip(keep)
    .select('_id')
    .lean();

  if (!extras.length) {
    return;
  }

  await Insight.deleteMany({ _id: { $in: extras.map(entry => entry._id) } });
};
