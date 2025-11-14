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
  role?: 'user' | 'admin' | 'superadmin';
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
    habits: {
      dailyGoalMinutes: { type: Number, default: 120 },
      notificationsEnabled: { type: Boolean, default: true }
    }
  },
  { timestamps: true }
);

export default model<UserDocument>('User', userSchema);
