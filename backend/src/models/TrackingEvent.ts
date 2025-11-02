import { Document, Schema, model } from 'mongoose';

export type TrackingEventType = 'scroll' | 'click' | 'idle' | 'focus' | 'blur';

export interface TrackingEventDocument extends Document {
  userId: Schema.Types.ObjectId;
  type: TrackingEventType;
  durationMs?: number;
  scrollDistance?: number;
  url: string;
  domain: string;
  metadata: Record<string, unknown>;
  startedAt?: Date;
  createdAt: Date;
}

const trackingEventSchema = new Schema<TrackingEventDocument>(
  {
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
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

trackingEventSchema.index({ userId: 1, createdAt: -1 });
trackingEventSchema.index({ userId: 1, domain: 1 });

export default model<TrackingEventDocument>('TrackingEvent', trackingEventSchema);
