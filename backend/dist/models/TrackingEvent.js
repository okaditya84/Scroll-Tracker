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
trackingEventSchema.index({ userId: 1, createdAt: -1 });
trackingEventSchema.index({ userId: 1, domain: 1 });
export default model('TrackingEvent', trackingEventSchema);
