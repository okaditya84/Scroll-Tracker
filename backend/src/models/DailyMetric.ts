import { Document, Schema, model } from 'mongoose';

export interface DailyMetricDocument extends Document {
  userId: Schema.Types.ObjectId;
  date: string;
  totals: {
    scrollDistance: number;
    activeMinutes: number;
    idleMinutes: number;
    clickCount: number;
  };
  breakdown: {
    domain: Array<{ domain: string; durationMs: number; scrollDistance?: number }>;
    hour: Record<string, number>;
  };
  lastComputedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const dailyMetricSchema = new Schema<DailyMetricDocument>(
  {
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
          new Schema(
            {
              domain: { type: String, required: true },
              durationMs: { type: Number, required: true },
              scrollDistance: { type: Number, default: 0 }
            },
            { _id: false }
          )
        ],
        default: []
      },
      hour: { type: Map, of: Number, default: {} }
    },
    lastComputedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

dailyMetricSchema.index({ userId: 1, date: -1 }, { unique: true });

export default model<DailyMetricDocument>('DailyMetric', dailyMetricSchema);
