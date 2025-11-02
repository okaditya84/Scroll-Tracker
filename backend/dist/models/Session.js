import { Schema, model } from 'mongoose';
const sessionSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    refreshTokenHash: { type: String, required: true },
    userAgent: { type: String },
    ip: { type: String },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date }
}, { timestamps: true });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default model('Session', sessionSchema);
