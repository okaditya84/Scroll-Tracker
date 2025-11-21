import { Document, Schema, model } from 'mongoose';

export type OtpPurpose = 'signup' | 'password_reset';
export type OtpStatus = 'pending' | 'verified' | 'expired' | 'locked';

export interface OtpCodeDocument extends Document {
  email: string;
  purpose: OtpPurpose;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  metadata?: Record<string, unknown>;
  channel: 'email';
  lastSentAt?: Date;
  usedAt?: Date;
  status: OtpStatus;
  requestIp?: string;
  requestUserAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const otpCodeSchema = new Schema<OtpCodeDocument>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    purpose: { type: String, required: true, enum: ['signup', 'password_reset'] },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    metadata: { type: Schema.Types.Mixed },
    channel: { type: String, default: 'email' },
    lastSentAt: { type: Date },
    usedAt: { type: Date },
    status: { type: String, enum: ['pending', 'verified', 'expired', 'locked'], default: 'pending', index: true },
    requestIp: { type: String },
    requestUserAgent: { type: String }
  },
  { timestamps: true }
);

otpCodeSchema.index({ email: 1, purpose: 1, createdAt: -1 });
otpCodeSchema.index({ createdAt: -1 });

export default model<OtpCodeDocument>('OtpCode', otpCodeSchema);
