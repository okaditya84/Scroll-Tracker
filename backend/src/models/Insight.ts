import { Document, Schema, model } from 'mongoose';

export interface InsightDocument extends Document {
  userId: Schema.Types.ObjectId;
  title: string;
  body: string;
  metricDate: string;
  tags: string[];
  metricSignature?: string;
  createdAt: Date;
  updatedAt: Date;
}

const insightSchema = new Schema<InsightDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    metricDate: { type: String, required: true },
    tags: [{ type: String }],
    metricSignature: { type: String }
  },
  { timestamps: true }
);

insightSchema.index({ userId: 1, updatedAt: -1, createdAt: -1 });
insightSchema.index({ userId: 1, metricDate: -1, updatedAt: -1 });

export default model<InsightDocument>('Insight', insightSchema);
