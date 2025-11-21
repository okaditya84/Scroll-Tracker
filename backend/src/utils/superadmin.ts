import env from '../config/env.js';
import type { UserDocument } from '../models/User.js';

const superEmail = env.SUPERADMIN_EMAIL?.toLowerCase().trim();
const adminEmailSet = new Set((env.adminEmails ?? []).map(email => email.toLowerCase()));

export const ensureSuperadminRole = async <T extends UserDocument | null | undefined>(user: T): Promise<T> => {
  if (!user) {
    return user;
  }

  const email = user.email?.toLowerCase();

  if (superEmail && email === superEmail) {
    if (user.role !== 'superadmin') {
      user.role = 'superadmin';
      await user.save();
    }
    return user;
  }

  if (email && adminEmailSet.has(email) && user.role === 'user') {
    user.role = 'admin';
    await user.save();
  }

  return user;
};
