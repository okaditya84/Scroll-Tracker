import bcrypt from 'bcryptjs';
import env from '../config/env.js';
import OtpCode from '../models/OtpCode.js';
import { sendMail } from '../utils/mailer.js';
import logger from '../utils/logger.js';
import HttpError from '../utils/httpError.js';
const OTP_CODE_LENGTH = 6;
const generateNumericCode = () => Array.from({ length: OTP_CODE_LENGTH })
    .map(() => Math.floor(Math.random() * 10).toString())
    .join('');
const buildOtpEmail = (purpose, code) => {
    const subject = purpose === 'signup' ? 'Verify your Scrollwise account' : 'Reset your Scrollwise password';
    const intro = purpose === 'signup'
        ? 'Use this one-time code to finish creating your Scrollwise account.'
        : 'Use this one-time code to finish resetting your Scrollwise password.';
    const text = `${intro}\n\n${code}\n\nThis code expires in ${env.OTP_TTL_MINUTES} minutes.`;
    const html = `
    <div style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; max-width: 420px; margin: 0 auto;">
      <p style="color:#0f172a; font-size:16px;">${intro}</p>
      <div style="background:#0f172a; color:#f8fafc; border-radius:16px; padding:16px; text-align:center; font-size:28px; letter-spacing:0.3em; font-weight:600;">
        ${code}
      </div>
      <p style="color:#475569; font-size:13px; margin-top:16px;">This code expires in ${env.OTP_TTL_MINUTES} minutes.</p>
    </div>
  `;
    return { subject, text, html };
};
export const issueOtp = async ({ email, purpose, metadata, context, ttlMinutes }) => {
    const normalizedEmail = email.toLowerCase().trim();
    const throttleWindow = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await OtpCode.countDocuments({
        email: normalizedEmail,
        purpose,
        createdAt: { $gte: throttleWindow }
    });
    if (recentCount >= env.OTP_THROTTLE_PER_HOUR) {
        throw new HttpError(429, 'Too many OTP requests. Please try again later.');
    }
    const code = generateNumericCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + (ttlMinutes ?? env.OTP_TTL_MINUTES) * 60 * 1000);
    const otp = await OtpCode.create({
        email: normalizedEmail,
        purpose,
        codeHash,
        expiresAt,
        metadata,
        maxAttempts: env.OTP_MAX_ATTEMPTS,
        requestIp: context?.ip,
        requestUserAgent: context?.userAgent
    });
    const message = buildOtpEmail(purpose, code);
    try {
        await sendMail({ to: normalizedEmail, ...message });
        otp.lastSentAt = new Date();
        await otp.save();
    }
    catch (error) {
        logger.error({ error }, 'Failed to deliver OTP email');
        await otp.deleteOne();
        throw new HttpError(502, 'Email delivery failed. Please try again later.');
    }
    return { id: otp._id?.toString?.() ?? '', expiresAt: otp.expiresAt };
};
const failWithStatus = async (otp, status) => {
    otp.status = status;
    await otp.save();
};
export const verifyOtp = async ({ email, purpose, code }) => {
    const normalizedEmail = email.toLowerCase().trim();
    const otp = await OtpCode.findOne({ email: normalizedEmail, purpose, status: 'pending' }).sort({ createdAt: -1 });
    if (!otp) {
        throw new HttpError(404, 'No active OTP request found.');
    }
    const now = new Date();
    if (otp.expiresAt < now) {
        await failWithStatus(otp, 'expired');
        throw new HttpError(410, 'The code has expired. Please request a new one.');
    }
    if (otp.attempts >= otp.maxAttempts) {
        await failWithStatus(otp, 'locked');
        throw new HttpError(423, 'Too many incorrect attempts. Please request a new code.');
    }
    const matches = await bcrypt.compare(code, otp.codeHash);
    otp.attempts += 1;
    if (!matches) {
        if (otp.attempts >= otp.maxAttempts) {
            await failWithStatus(otp, 'locked');
        }
        else {
            await otp.save();
        }
        throw new HttpError(400, 'Incorrect code.');
    }
    otp.usedAt = now;
    otp.status = 'verified';
    await otp.save();
    return otp;
};
export const buildOtpMetrics = async (windowDays = 14) => {
    const since = new Date();
    since.setDate(since.getDate() - windowDays);
    const totalsRaw = await OtpCode.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
            $group: {
                _id: { purpose: '$purpose', status: '$status' },
                count: { $sum: 1 }
            }
        }
    ]);
    const dailyRaw = await OtpCode.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
            $project: {
                purpose: 1,
                status: 1,
                day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
            }
        },
        {
            $group: {
                _id: { day: '$day', purpose: '$purpose', status: '$status' },
                count: { $sum: 1 }
            }
        },
        { $sort: { '_id.day': 1 } }
    ]);
    const totals = {};
    totalsRaw.forEach(entry => {
        const purposeKey = entry._id.purpose;
        const statusKey = entry._id.status;
        totals[purposeKey] = totals[purposeKey] ?? {};
        totals[purposeKey][statusKey] = entry.count;
    });
    const dailyMap = new Map();
    dailyRaw.forEach(entry => {
        const day = entry._id.day;
        const purposeKey = entry._id.purpose;
        const statusKey = entry._id.status;
        const bucket = dailyMap.get(day) ?? {
            day,
            signup: {},
            password_reset: {}
        };
        bucket[purposeKey][statusKey] = entry.count;
        dailyMap.set(day, bucket);
    });
    const daily = Array.from(dailyMap.values()).sort((a, b) => a.day.localeCompare(b.day));
    return { windowDays, totals, daily };
};
