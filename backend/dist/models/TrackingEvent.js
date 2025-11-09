import { Schema, model } from 'mongoose';
const trackingEventSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
        type: String,
        enum: ['scroll', 'click', 'idle', 'focus', 'blur'],
        required: true
    },
    durationMs: { type: Number },
    scrollDistance: { type: Number },
    url: { type: String, required: true },
    domain: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    startedAt: { type: Date }
}, { timestamps: { createdAt: true, updatedAt: false } });
// allow deduplication by a client-supplied idempotency key (per user)
trackingEventSchema.add({ idempotencyKey: { type: String, index: false } });
trackingEventSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $exists: true } } });
trackingEventSchema.index({ userId: 1, createdAt: -1 });
trackingEventSchema.index({ userId: 1, domain: 1 });
export default model('TrackingEvent', trackingEventSchema);
