import { Schema, model } from 'mongoose';
const insightSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    metricDate: { type: String, required: true },
    tags: [{ type: String }],
    metricSignature: { type: String }
}, { timestamps: true });
insightSchema.index({ userId: 1, updatedAt: -1, createdAt: -1 });
insightSchema.index({ userId: 1, metricDate: -1, updatedAt: -1 });
export default model('Insight', insightSchema);
