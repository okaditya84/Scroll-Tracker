import { Schema, model } from 'mongoose';
const otpCodeSchema = new Schema({
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
}, { timestamps: true });
otpCodeSchema.index({ email: 1, purpose: 1, createdAt: -1 });
otpCodeSchema.index({ createdAt: -1 });
export default model('OtpCode', otpCodeSchema);
