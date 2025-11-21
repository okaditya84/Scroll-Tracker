import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDb from '../config/db.js';
import logger from '../utils/logger.js';
import Audit from '../models/Audit.js';
import ContactMessage from '../models/ContactMessage.js';
import DailyMetric from '../models/DailyMetric.js';
import Insight from '../models/Insight.js';
import OtpCode from '../models/OtpCode.js';
import Policy from '../models/Policy.js';
import Session from '../models/Session.js';
import TrackingEvent from '../models/TrackingEvent.js';
import User from '../models/User.js';

const ADMIN_EMAIL = 'tryreverseai@gmail.com';
const ADMIN_PASSWORD = 'hArrYPOTTER@4';

const collections = [
  { name: 'Audit', clear: () => Audit.deleteMany({}) },
  { name: 'ContactMessage', clear: () => ContactMessage.deleteMany({}) },
  { name: 'DailyMetric', clear: () => DailyMetric.deleteMany({}) },
  { name: 'Insight', clear: () => Insight.deleteMany({}) },
  { name: 'OtpCode', clear: () => OtpCode.deleteMany({}) },
  { name: 'Policy', clear: () => Policy.deleteMany({}) },
  { name: 'Session', clear: () => Session.deleteMany({}) },
  { name: 'TrackingEvent', clear: () => TrackingEvent.deleteMany({}) },
  { name: 'User', clear: () => User.deleteMany({}) }
];

const seedAdmin = async () => {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
  if (existing) {
    logger.info({ email: ADMIN_EMAIL }, 'Admin already exists, skipping creation');
    return existing;
  }

  const admin = await User.create({
    email: ADMIN_EMAIL.toLowerCase(),
    passwordHash,
    displayName: 'Scrollwise Admin',
    role: 'admin',
    accountStatus: 'active',
    timezone: 'UTC'
  });

  logger.info({ email: admin.email }, 'Created fresh admin user');
  return admin;
};

const resetUsers = async () => {
  logger.info('Connecting to MongoDB...');
  await connectDb();

  for (const { name, clear } of collections) {
    const result = await clear();
    logger.info({ collection: name, deleted: result.deletedCount }, 'Cleared collection');
  }

  await seedAdmin();
};

resetUsers()
  .then(async () => {
    logger.info('User data reset complete');
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async error => {
    logger.error({ error }, 'User data reset failed');
    await mongoose.disconnect();
    process.exit(1);
  });
