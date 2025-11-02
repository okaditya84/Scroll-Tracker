import { Schema, model } from 'mongoose';
const dailyMetricSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    totals: {
        scrollDistance: { type: Number, default: 0 },
        activeMinutes: { type: Number, default: 0 },
        idleMinutes: { type: Number, default: 0 },
        clickCount: { type: Number, default: 0 }
    },
    breakdown: {
        domain: {
            type: [
                new Schema({
                    domain: { type: String, required: true },
                    durationMs: { type: Number, required: true },
                    scrollDistance: { type: Number, default: 0 }
                }, { _id: false })
            ],
            default: []
        },
        hour: { type: Map, of: Number, default: {} }
    },
    lastComputedAt: { type: Date, default: Date.now }
}, { timestamps: true });
dailyMetricSchema.index({ userId: 1, date: -1 }, { unique: true });
export default model('DailyMetric', dailyMetricSchema);
