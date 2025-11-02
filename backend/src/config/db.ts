import mongoose from 'mongoose';
import env from './env.js';
import logger from '../utils/logger.js';

const normalizeMongoUri = (uri: string): string => {
  try {
    const parsed = new URL(uri);

    if (parsed.username) {
      parsed.username = encodeURIComponent(decodeURIComponent(parsed.username));
    }

    if (parsed.password) {
      parsed.password = encodeURIComponent(decodeURIComponent(parsed.password));
    }

    return parsed.toString();
  } catch (error) {
    logger.warn({ error }, 'Failed to normalize MongoDB URI, using raw value');
    return uri;
  }
};

const connectDb = async () => {
  mongoose.set('strictQuery', true);
  const normalizedUri = normalizeMongoUri(env.MONGODB_URI);
  await mongoose.connect(normalizedUri);
  logger.info('MongoDB connected');
};

export default connectDb;
