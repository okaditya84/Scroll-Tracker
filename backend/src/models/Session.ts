import { Document, Schema, model } from 'mongoose';

export interface SessionDocument extends Document {
  _id: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  refreshTokenHash: string;
  userAgent?: string;
  ip?: string;
  lastUsedAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  revokedAt?: Date;
}

const sessionSchema = new Schema<SessionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    refreshTokenHash: { type: String, required: true },
    userAgent: { type: String },
    ip: { type: String },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date }
  },
  { timestamps: true }
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default model<SessionDocument>('Session', sessionSchema);
