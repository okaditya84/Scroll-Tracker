import { Document, Schema, model } from 'mongoose';

export interface UserDocument extends Document {
  _id: Schema.Types.ObjectId;
  email: string;
  passwordHash?: string;
  googleId?: string;
  displayName: string;
  avatarUrl?: string;
  timezone?: string;
  habits?: {
    dailyGoalMinutes?: number;
    notificationsEnabled?: boolean;
  };
  focusSettings?: {
    blocklist: string[];
    strictMode: boolean;
    dailyGoalMinutes: number;
  };
  focusSessions?: {
    startTime: Date;
    endTime?: Date;
    durationMinutes?: number;
    success?: boolean;
    interruptionCount?: number;
  }[];
  role?: 'user' | 'admin' | 'superadmin';
  accountStatus?: 'active' | 'invited' | 'suspended';
  tracking?: {
    paused: boolean;
    pausedAt?: Date;
    reason?: string;
  };
  presence?: {
    lastEventAt?: Date;
    lastEventType?: string;
    lastUrl?: string;
    lastDomain?: string;
    lastDurationMs?: number;
    lastScrollDistance?: number;
  };
  contact?: {
    phone?: string;
    company?: string;
    jobTitle?: string;
    location?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    displayName: { type: String, required: true },
    avatarUrl: { type: String },
    timezone: { type: String, default: 'UTC' },
    role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' },
    accountStatus: { type: String, enum: ['active', 'invited', 'suspended'], default: 'active' },
    habits: {
      dailyGoalMinutes: { type: Number, default: 120 },
      notificationsEnabled: { type: Boolean, default: true }
    },
    focusSettings: {
      blocklist: [{ type: String }],
      strictMode: { type: Boolean, default: false },
      dailyGoalMinutes: { type: Number, default: 240 }, // 4 hours deep work
      dailyLimitMinutes: { type: Number, default: 30 } // 30 mins distraction limit
    },
    focusSessions: [{
      startTime: { type: Date, required: true },
      endTime: { type: Date },
      durationMinutes: { type: Number },
      success: { type: Boolean },
      interruptionCount: { type: Number, default: 0 }
    }],
    tracking: {
      paused: { type: Boolean, default: false },
      pausedAt: { type: Date },
      reason: { type: String, trim: true, maxlength: 512 }
    },
    presence: {
      lastEventAt: { type: Date },
      lastEventType: { type: String },
      lastUrl: { type: String },
      lastDomain: { type: String },
      lastDurationMs: { type: Number },
      lastScrollDistance: { type: Number }
    },
    contact: {
      phone: { type: String, trim: true },
      company: { type: String, trim: true },
      jobTitle: { type: String, trim: true },
      location: { type: String, trim: true }
    }
  },
  { timestamps: true }
);

export default model<UserDocument>('User', userSchema);
